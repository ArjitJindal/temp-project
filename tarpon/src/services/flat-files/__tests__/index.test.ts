import { Readable } from 'stream'
import { v4 as uuidv4 } from 'uuid'
import { S3 } from '@aws-sdk/client-s3'
import { JsonMigrationService } from 'thunder-schema'
import { StackConstants } from '@lib/constants'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import { FlatFilesService } from '..'
import { UserUploadRunner } from '../batchRunner/user-upload'
import { getCSVFormattedRow, mockBusinessUser, mockConsumerUser } from './utils'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { BatchJob, FlatFilesValidationBatchJob } from '@/@types/batch-job'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  createTenantDatabase,
  getClickhouseCredentials,
} from '@/utils/clickhouse/utils'
import { diff as createDiff } from '@/models/migrations/1747929216549-migration'
import { diff as updateDiff } from '@/models/migrations/1747986678506-migration'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { User } from '@/@types/openapi-internal/User'
import { runAsyncRules } from '@/lambdas/async-rule/app'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { UserType } from '@/@types/openapi-internal/UserType'
import { Business } from '@/@types/openapi-internal/Business'

dynamoDbSetupHook()

jest.mock('@/services/batch-jobs/batch-job', () => ({
  sendBatchJobCommand: jest.fn(),
}))

jest.mock('@aws-sdk/client-s3', () => {
  const original = jest.requireActual('@aws-sdk/client-s3')
  return {
    ...original,
    S3: jest.fn().mockImplementation(() => {
      return {
        send: jest.fn(),
      }
    }),
  }
})

const createFlatFilesTables = async (tenantId: string) => {
  await createTenantDatabase(tenantId)
  const defaultConfig = await getClickhouseCredentials(tenantId)
  const jsonMigrationService = new JsonMigrationService(defaultConfig)
  // @ts-expect-error: need a libaray update
  await jsonMigrationService.migrate(`${uuidv4()}.ts`, createDiff)
  // @ts-expect-error: need a libaray update
  await jsonMigrationService.migrate(`${uuidv4()}.ts`, updateDiff)
}

describe('FlatFilesService', () => {
  const mockSend = jest.fn()
  const TEST_TENANT_ID = getTestTenantId()
  let service: FlatFilesService

  beforeEach(async () => {
    service = new FlatFilesService(TEST_TENANT_ID)
    ;(S3 as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))
    jest.clearAllMocks()
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

          // Verify that the template contains expected headers from CaseClosure model
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
  describe('User FFIP test', () => {
    describe('should save users to database', () => {
      beforeAll(async () => {
        // create flat files tables
        if (!globalThis.__didCreateTables__) {
          await createFlatFilesTables(TEST_TENANT_ID)
          globalThis.__didCreateTables__ = true
        }
      })

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
      ] as { schema: FlatFileSchema; type: UserType; seeder: () => User | Business }[])(
        'for schema %s.type',
        ({ schema, type, seeder }) => {
          it('should save users to database', async () => {
            // mock the sendBatchJobCommand
            ;(sendBatchJobCommand as jest.Mock).mockImplementation(
              async (job: BatchJob) => {
                const jobId = uuidv4()
                await jobRunnerHandler({ ...job, jobId })
              }
            )

            jest
              .spyOn(UserUploadRunner.prototype, 'batchRun')
              .mockImplementation(async (batchId, records) => {
                for (const record of records) {
                  await runAsyncRules({
                    type: 'USER_BATCH',
                    userType: type,
                    user: record.data as User,
                    tenantId: TEST_TENANT_ID,
                    batchId: batchId,
                  })
                }
              })

            // create a csv file
            const fileRows: string[] = []
            const headers = (
              await service.generateTemplate(schema, 'CSV')
            ).keys.join(',')
            fileRows.push(headers)

            const user1 = seeder()
            const user2 = seeder()

            const user1Row = await getCSVFormattedRow(user1, service, schema)
            const user2Row = await getCSVFormattedRow(user2, service, schema)

            fileRows.push(user1Row)
            fileRows.push(user2Row)

            const mockStream = Readable.from([fileRows.join('\n')])
            mockSend.mockResolvedValue({ Body: mockStream })

            const testJob: FlatFilesValidationBatchJob = {
              tenantId: TEST_TENANT_ID,
              type: 'FLAT_FILES_VALIDATION',
              parameters: {
                format: 'CSV',
                s3Key: 'test.csv',
                schema,
              },
            }

            // call the batch job to parse and store user from csv file
            await sendBatchJobCommand(testJob)

            // check for the saved user in the database
            const dynamoDb = getDynamoDbClient()

            const getUserFromDynamo = async (userId: string) => {
              const dynamoUser = await dynamoDb.send(
                new GetCommand({
                  TableName:
                    StackConstants.TARPON_DYNAMODB_TABLE_NAME(TEST_TENANT_ID),
                  Key: DynamoDbKeys.USER(TEST_TENANT_ID, userId),
                })
              )
              return omit(dynamoUser.Item, [
                'PartitionKeyID',
                'SortKeyID',
                'hitRules',
                'executedRules',
                'status',
                'type',
              ])
            }

            const dynamoUser1 = await getUserFromDynamo(user1.userId)
            const dynamoUser2 = await getUserFromDynamo(user2.userId)
            expect(dynamoUser1).toEqual(user1)
            expect(dynamoUser2).toEqual(user2)
          })
        }
      )
    })
  })
})
