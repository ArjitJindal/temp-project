import { Readable } from 'stream'
import { v4 as uuidv4 } from 'uuid'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { StackConstants } from '@lib/constants'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import omit from 'lodash/omit'
import { FlatFilesService } from '..'
import {
  getCSVFormattedRow,
  mockBusinessUser,
  mockConsumerUser,
  mockTransaction,
} from './utils'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { jobRunnerHandler } from '@/lambdas/batch-job-runner/app'
import { BatchJob, FlatFilesValidationBatchJob } from '@/@types/batch-job'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { User } from '@/@types/openapi-internal/User'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  disableAsyncRulesInTest,
  enableAsyncRulesInTest,
} from '@/test-utils/transaction-test-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { thunderSchemaSetupHook } from '@/test-utils/clickhouse-test-utils'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { UserService } from '@/services/users'
import {
  disableLocalChangeHandler,
  enableLocalChangeHandler,
} from '@/utils/local-change-handler'

dynamoDbSetupHook()

jest.mock('@/services/batch-jobs/batch-job', () => ({
  sendBatchJobCommand: jest.fn(),
}))

const createS3MockResponse = (stream: Readable) =>
  ({
    Body: stream,
    ContentLength: 1024,
    ContentType: 'text/csv',
    ETag: '"mock-etag"',
    LastModified: new Date(),
  } as any)

describe('FlatFilesService', () => {
  const TEST_TENANT_ID = getTestTenantId()
  thunderSchemaSetupHook(TEST_TENANT_ID, [
    FlatFilesRecords.tableDefinition.tableName,
  ])
  let service: FlatFilesService
  beforeEach(async () => {
    service = new FlatFilesService(TEST_TENANT_ID)
  })

  describe('generateTemplate', () => {
    describe.each([
      { schema: 'BULK_CASE_CLOSURE' },
      {
        schema: 'CUSTOM_LIST_UPLOAD',
        metadata: {
          items: [
            { key: 'Key', type: 'STRING' },
            { key: 'Value', type: 'STRING' },
          ],
        },
      },
      { schema: 'CONSUMER_USERS_UPLOAD' },
      { schema: 'BUSINESS_USERS_UPLOAD' },
    ] as { schema: FlatFileSchema; metadata?: object }[])(
      'generateTemplate for key %s',
      ({ schema, metadata }) => {
        it(`should generate CSV template for ${schema} schema`, async () => {
          const template = await service.generateTemplate(
            schema,
            'CSV',
            metadata
          )

          expect(template).toBeDefined()
          expect(template.keys).toBeInstanceOf(Array)
          expect(template.fileString).toBeDefined()

          if (!template.fileString) {
            throw new Error('Template fileString is undefined')
          }

          expect(template.fileString).toContain('\n')

          const headers = template.fileString.split('\n')[0].split(',')
          expect(headers.length).toBeGreaterThan(0)
        })
      }
    )

    it('should throw error for unsupported format', async () => {
      const unsupportedFormat = 'UNSUPPORTED' as FlatFileTemplateFormat

      await expect(
        service.generateTemplate('BULK_CASE_CLOSURE', unsupportedFormat)
      ).rejects.toThrow(
        `Unsupported format '${unsupportedFormat}' for tenant ${TEST_TENANT_ID}`
      )
    })

    it('should use correct model for BULK_CASE_CLOSURE schema', async () => {
      const template = await service.generateTemplate(
        'BULK_CASE_CLOSURE',
        'CSV'
      )

      // Verify that the template contains headers that match CaseClosure model structure
      if (!template.fileString) {
        throw new Error('Template fileString is undefined')
      }

      const headers = template.fileString.split('\n')[0].split(',')

      // Add specific assertions based on CaseClosure model structure
      // This is a basic example - you should add more specific assertions based on your actual model
      expect(headers).toContain('caseId')
    })

    it('should work for custom list upload', async () => {
      const model = await service.getModel('CUSTOM_LIST_UPLOAD', {
        items: [
          {
            key: 'key',
            type: 'STRING',
          },
        ],
      })

      expect(model).toBeDefined()
    })
  })

  describe('Flat file import test', () => {
    const s3Mock = mockClient(S3Client)
    beforeAll(async () => {
      enableAsyncRulesInTest()
      enableLocalChangeHandler()

      if (!globalThis.__didCreateTables__) {
        globalThis.__didCreateTables__ = true
      }
      ;(sendBatchJobCommand as jest.Mock).mockImplementation(
        async (job: BatchJob) => {
          const jobId = uuidv4()
          await jobRunnerHandler({ ...job, jobId })
        }
      )
    })
    afterAll(() => {
      disableLocalChangeHandler()
      disableAsyncRulesInTest()
    })
    beforeEach(() => {
      s3Mock.reset()
    })

    const getUserFromDynamo = async (userId: string) => {
      const dynamoDb = getDynamoDbClient()
      const result = await dynamoDb.send(
        new GetCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(TEST_TENANT_ID),
          Key: DynamoDbKeys.USER(TEST_TENANT_ID, userId),
        })
      )
      return omit(result.Item, [
        'PartitionKeyID',
        'SortKeyID',
        'hitRules',
        'executedRules',
        'status',
        'type',
      ])
    }

    const getTransactionFromDynamo = async (
      transactionId: string,
      timestamp: number
    ) => {
      const dynamoDb = getDynamoDbClient()
      const result = await dynamoDb.send(
        new GetCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(TEST_TENANT_ID),
          Key: DynamoDbKeys.TRANSACTION(
            TEST_TENANT_ID,
            transactionId,
            timestamp
          ),
        })
      )
      return omit(result.Item, [
        'PartitionKeyID',
        'SortKeyID',
        'transactionState',
        'hitRules',
        'executedRules',
        'status',
      ])
    }

    const createMockCSVStream = async (
      records: any[],
      schema: FlatFileSchema
    ) => {
      const fileRows: string[] = []
      const headers = (await service.generateTemplate(schema, 'CSV')).keys.join(
        ','
      )
      fileRows.push(headers)

      for (const record of records) {
        const row = await getCSVFormattedRow(record, service, schema)
        fileRows.push(row)
      }

      return Readable.from([fileRows.join('\n')])
    }

    describe('User flat file import', () => {
      describe.each([
        {
          schema: 'CONSUMER_USERS_UPLOAD',
          type: 'CONSUMER',
          seeder: mockConsumerUser,
        },
        {
          schema: 'BUSINESS_USERS_UPLOAD',
          type: 'BUSINESS',
          seeder: mockBusinessUser,
        },
      ] as const)(
        'validate CSV file import for $type',
        ({ schema, type, seeder }) => {
          it(`should save ${type} users to database`, async () => {
            const s3Key = `${TEST_TENANT_ID}/test-${uuidv4()}.csv`
            const user1 = seeder()
            const user2 = seeder()
            const mockStream = await createMockCSVStream([user1, user2], schema)
            s3Mock
              .on(GetObjectCommand)
              .resolves(createS3MockResponse(mockStream))

            const testJob: FlatFilesValidationBatchJob = {
              tenantId: TEST_TENANT_ID,
              type: 'FLAT_FILES_VALIDATION',
              parameters: {
                format: 'CSV',
                s3Key,
                schema,
                entityId:
                  type === 'CONSUMER' ? 'CONSUMER_USERS' : 'BUSINESS_USERS',
              },
            }

            await sendBatchJobCommand(testJob)

            const dynamoUser1 = await getUserFromDynamo(user1.userId)
            const dynamoUser2 = await getUserFromDynamo(user2.userId)

            expect(dynamoUser1).toMatchObject(user1)
            expect(dynamoUser2).toMatchObject(user2)
          })
        }
      )
    })

    describe('Duplicate user import', () => {
      // reset the tenant id as if running the whole test suite we create users in previous test, which doesn't give the desired result
      const TEST_TENANT_ID = getTestTenantId()
      thunderSchemaSetupHook(TEST_TENANT_ID, [
        FlatFilesRecords.tableDefinition.tableName,
      ])
      it('should not save duplicate users', async () => {
        enableAsyncRulesInTest()
        enableLocalChangeHandler()
        const s3Key = `${TEST_TENANT_ID}/test-${uuidv4()}.csv`
        const user1 = mockConsumerUser()
        const user2 = { ...mockConsumerUser(), userId: user1 }
        const user3 = mockConsumerUser()
        const mockStream = await createMockCSVStream(
          [user1, user2, user3],
          'CONSUMER_USERS_UPLOAD'
        )
        s3Mock.on(GetObjectCommand).resolves(createS3MockResponse(mockStream))

        const testJob: FlatFilesValidationBatchJob = {
          tenantId: TEST_TENANT_ID,
          type: 'FLAT_FILES_VALIDATION',
          parameters: {
            format: 'CSV',
            s3Key,
            schema: 'CONSUMER_USERS_UPLOAD',
            entityId: 'CONSUMER_USERS',
          },
        }

        await sendBatchJobCommand(testJob)

        const dynamoDb = getDynamoDbClient()
        const mongoDb = await getMongoDbClient()
        const userService = new UserService(TEST_TENANT_ID, {
          dynamoDb,
          mongoDb,
        })
        const user = await userService.getUsers({
          pageSize: 100,
          page: 1,
        })
        expect(user).toBeDefined()
        expect(user.result).toHaveLength(2)
      })
    })

    describe('Transaction flat file import', () => {
      it('should save TRANSACTION to database', async () => {
        const s3Key = `${TEST_TENANT_ID}/test-${uuidv4()}.csv`
        const dynamoDb = getDynamoDbClient()
        const mongoDb = await getMongoDbClient()
        const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
        const userManagementService = new UserManagementService(
          TEST_TENANT_ID,
          dynamoDb,
          mongoDb,
          logicEvaluator
        )

        const user1 = mockConsumerUser()
        const user2 = mockConsumerUser()

        await Promise.all([
          userManagementService.createAndVerifyUser(user1 as User, true, {}),
          userManagementService.createAndVerifyUser(user2 as User, true, {}),
        ])

        const transaction1 = mockTransaction(user1.userId, user2.userId)
        const transaction2 = mockTransaction(user2.userId, user1.userId)

        const mockStream = await createMockCSVStream(
          [transaction1, transaction2],
          'TRANSACTIONS_UPLOAD'
        )

        s3Mock.on(GetObjectCommand).resolves(createS3MockResponse(mockStream))

        const testJob: FlatFilesValidationBatchJob = {
          tenantId: TEST_TENANT_ID,
          type: 'FLAT_FILES_VALIDATION',
          parameters: {
            format: 'CSV',
            s3Key,
            schema: 'TRANSACTIONS_UPLOAD',
            entityId: 'TRANSACTIONS',
          },
        }

        await sendBatchJobCommand(testJob)

        const dynamoTransaction1 = await getTransactionFromDynamo(
          transaction1.transactionId,
          transaction1.timestamp
        )
        const dynamoTransaction2 = await getTransactionFromDynamo(
          transaction2.transactionId,
          transaction2.timestamp
        )

        expect(dynamoTransaction1).toMatchObject(transaction1)
        expect(dynamoTransaction2).toMatchObject(transaction2)
      })
    })
  })
})
