import { NotFound, BadRequest } from 'http-errors'
import { cloneDeep } from 'lodash'
import { ObjectId } from 'mongodb'
import { nanoid } from 'nanoid'
import { CaseService } from '..'
import { CASE_TRANSACTIONS } from './utils/case-transactions'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CaseRepository } from '@/services/cases/repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService } from '@/services/accounts'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { AlertsService } from '@/services/alerts'
import { AlertsRepository } from '@/services/alerts/repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { getS3ClientByEvent } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import * as Context from '@/core/utils/context-storage'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import dayjs from '@/utils/dayjs'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import { getTestUser } from '@/test-utils/user-test-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserService } from '@/services/users'
import { enableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { Account } from '@/@types/openapi-internal/Account'
import { prepareClickhouseInsert } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

const TEST_ACCOUNT_1: Account = {
  id: 'ACCOUNT-1',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'ACCOUNT-1',
  blocked: false,
  escalationLevel: 'L1',
  escalationReviewerId: 'ACCOUNT-4',
}

const TEST_ACCOUNT_2: Account = {
  id: 'ACCOUNT-2',
  role: 'analyst',
  email: 'abc@email.com',
  emailVerified: true,
  name: 'ACCOUNT-2',
  blocked: false,
}

const REVIEWEE: Account = {
  id: 'ACCOUNT-3',
  role: 'admin',
  email: 'abcd@email.com',
  emailVerified: true,
  name: 'ACCOUNT-3',
  blocked: false,
  reviewerId: 'ACCOUNT-1',
}

const ESCALATION_L2_ACCOUNT: Account = {
  id: 'ACCOUNT-4',
  role: 'admin',
  email: 'abcde@email.com',
  emailVerified: true,
  name: 'ACCOUNT-4',
  blocked: false,
  escalationLevel: 'L2',
}

const CASE_TRANSACTION_IDS = ['T-1', 'T-2', 'T-3', 'T-4']

const TEST_ALERT_1: Alert & { alertId: string } = {
  alertId: 'A-1',
  alertStatus: 'OPEN',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleInstanceId: 'rid-131',
  ruleName: '',
  ruleDescription: '',
  ruleId: '',
  ruleAction: 'FLAG',
  numberOfTransactionsHit: 1,
  priority: 'P1' as Priority,
}

const TEST_ALERT_2: Alert & { alertId: string } = {
  alertId: 'A-2',
  alertStatus: 'CLOSED',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleInstanceId: 'rid-2',
  ruleName: '',
  ruleDescription: '',
  ruleId: '',
  ruleAction: 'FLAG',
  numberOfTransactionsHit: 1,
  priority: 'P1' as Priority,
}

const TEST_ALERT_3: Alert = {
  alertId: 'A-3',
  alertStatus: 'OPEN',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleInstanceId: 'rid-3',
  ruleName: '',
  ruleDescription: '',
  ruleId: '',
  ruleAction: 'FLAG',
  numberOfTransactionsHit: 1,
  priority: 'P1' as Priority,
}

dynamoDbSetupHook()
enableLocalChangeHandler()
withFeatureHook(['ADVANCED_WORKFLOWS', 'CLICKHOUSE_ENABLED'])

jest.mock('@/core/utils/context-storage', () => {
  const originalModule = jest.requireActual<
    typeof import('@/core/utils/context-storage')
  >('@/core/utils/context-storage')

  return {
    ...originalModule,
    __esModule: true,
    getContext: jest.fn().mockImplementation(() => {
      return {
        user: TEST_ACCOUNT_1,
      }
    }),
  }
})

async function getCaseService(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const s3 = getS3ClientByEvent(null as any)

  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.CASES_V2.tableName,
    tenantId
  )
  const caseRepository = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const caseService = new CaseService(caseRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })

  return caseService
}

async function getAlertsService(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const s3 = getS3ClientByEvent(null as any)

  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
    tenantId
  )
  const alertsRepository = new AlertsRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const alertsService = new AlertsService(alertsRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })

  return alertsService
}

async function getUsersService(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const usersService = new UserService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  return usersService
}

async function getUsersRepository(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const usersService = new UserRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })

  return usersService
}

const getContextMocker = jest.spyOn(Context, 'getContext')

jest
  .spyOn(AccountsService.prototype, 'getAccount')
  .mockImplementation(async (accountId: string) => {
    if (accountId === TEST_ACCOUNT_1.id) {
      return TEST_ACCOUNT_1
    } else if (accountId === TEST_ACCOUNT_2.id) {
      return TEST_ACCOUNT_2
    } else if (accountId === REVIEWEE.id) {
      return REVIEWEE
    } else if (accountId === ESCALATION_L2_ACCOUNT.id) {
      return ESCALATION_L2_ACCOUNT
    }
    return TEST_ACCOUNT_1
  })

jest
  .spyOn(AccountsService.prototype, 'getAllActiveAccounts')
  .mockImplementation(async () => {
    return [TEST_ACCOUNT_1, TEST_ACCOUNT_2, REVIEWEE, ESCALATION_L2_ACCOUNT]
  })

describe('Case service', () => {
  beforeAll(async () => {
    getContextMocker.mockReturnValue({
      user: {
        id: 'ACCOUNT-1',
        role: 'admin',
      },
    })
  })

  describe('Escalation: single case', () => {
    const TEST_TENANT_ID = getTestTenantId()

    test('throw NotFound error if case ID cannot be found', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      await expect(
        caseService.escalateCase('ghost', {
          reason: ['Documents collected'],
        })
      ).rejects.toThrow(NotFound)
    })

    test('update case status, update alert statuses, and assign review assignments', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      await caseService.caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })

      await caseService.escalateCase('C-1', {
        comment: 'test comment',
        reason: ['Documents collected'],
      })

      const c = (await caseService.getCase('C-1')).result

      expect(c).toMatchObject({
        caseId: 'C-1',
        createdTimestamp: t,
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: expect.any(Number) }],
        reviewAssignments: [
          { assigneeUserId: 'ACCOUNT-1', timestamp: expect.any(Number) },
        ],
        alerts: [
          {
            ...TEST_ALERT_1,
            reviewAssignments: [
              { assigneeUserId: 'ACCOUNT-1', timestamp: expect.any(Number) },
            ],
            alertStatus: 'ESCALATED',
            statusChanges: [
              expect.objectContaining({
                caseStatus: 'ESCALATED',
                timestamp: expect.any(Number),
              }),
            ],
            lastStatusChange: expect.objectContaining({
              caseStatus: 'ESCALATED',
              timestamp: expect.any(Number),
            }),
          },
          TEST_ALERT_2,
        ],
        lastStatusChange: expect.objectContaining({
          timestamp: expect.any(Number),
          caseStatus: 'ESCALATED',
        }),
        comments: [
          expect.objectContaining({
            body: 'Case status changed to Escalated. Reason: Documents collected\ntest comment',
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
          }),
        ],
      })
    })

    test('keeps the existing review assignments', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      await caseService.caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1', timestamp: t }],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseService.escalateCase('C-2', { reason: ['Documents collected'] })
      const c = (await caseService.getCase('C-2')).result
      expect(c).toMatchObject({
        caseId: 'C-2',
        reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1', timestamp: t }],
      })
    })
  })
  describe('Escalation: alerts within a case', () => {
    const TEST_TENANT_ID = getTestTenantId()

    test('throw NotFound error if case ID cannot be found', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      await expect(
        caseService.escalateCase('ghost', { reason: ['Anti-money laundering'] })
      ).rejects.toThrow(NotFound)
    })

    test('escalate alert - new case status, updated alert statuses, and keep old case status the same', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)

      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      await caseService.caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseTransactionsIds: CASE_TRANSACTION_IDS,
        caseHierarchyDetails: {
          childTransactionIds: ['T-101'],
        },
        caseType: 'SYSTEM',
        caseAggregates: CASE_TRANSACTIONS.reduce((acc, t) => {
          if (t.originPaymentDetails?.method) {
            acc.originPaymentMethods.push(t.originPaymentDetails.method)
          }

          if (t.destinationPaymentDetails?.method) {
            acc.destinationPaymentMethods.push(
              t.destinationPaymentDetails.method
            )
          }

          if (t.tags?.length) {
            acc.tags.push(...t.tags)
          }

          return acc
        }, cloneDeep(DEFAULT_CASE_AGGREGATES)),
      })

      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await alertsService.escalateAlerts('C-2', {
        alertEscalations: [
          { alertId: TEST_ALERT_1.alertId ?? '', transactionIds: [] },
        ],
        caseUpdateRequest: {
          reason: ['Fraud'],
          comment: 'test',
          files: [{ s3Key: 's3Key', filename: 'filename', size: 10 }],
        },
      })

      const c = (await caseService.getCase('C-2.1')).result
      expect(c).toMatchObject({
        caseId: 'C-2.1',
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: expect.any(Number) }],
        reviewAssignments: [
          { assigneeUserId: TEST_ACCOUNT_1.id, timestamp: expect.any(Number) },
        ],
        caseHierarchyDetails: {
          parentCaseId: 'C-2',
        },
        alerts: [
          {
            ...TEST_ALERT_1,
            alertId: `${TEST_ALERT_1.alertId}`,
            reviewAssignments: [
              {
                assigneeUserId: TEST_ACCOUNT_1.id,
                timestamp: expect.any(Number),
              },
            ],
            alertStatus: 'ESCALATED',
            statusChanges: [
              expect.objectContaining({
                caseStatus: 'ESCALATED',
                timestamp: expect.any(Number),
              }),
            ],
            lastStatusChange: expect.objectContaining({
              caseStatus: 'ESCALATED',
              timestamp: expect.any(Number),
            }),
          },
        ],
        comments: [
          expect.objectContaining({
            body: 'Case status changed to Escalated. Reason: Fraud\ntest',
            files: [
              expect.objectContaining({
                filename: 'filename',
                s3Key: 's3Key',
                size: 10,
              }),
            ],
            userId: TEST_ACCOUNT_1.id,
          }),
        ],
      })
      const oldCase = (await caseService.getCase('C-2')).result
      expect(oldCase).toMatchObject({
        caseId: 'C-2',
        caseStatus: 'OPEN',
        caseHierarchyDetails: {
          childTransactionIds: ['T-101'],
        },
        alerts: [TEST_ALERT_2],
      })
    })
    test('escalateAlerts throws error if caseId is null', async () => {
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await expect(
        alertsService.escalateAlerts(null as unknown as string, {
          caseUpdateRequest: { reason: [] },
        })
      ).rejects.toThrow(NotFound)
    })

    test('escalateAlerts throws error if caseId is undefined', async () => {
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await expect(
        alertsService.escalateAlerts(undefined as unknown as string, {
          caseUpdateRequest: { reason: [] },
        })
      ).rejects.toThrow(NotFound)
    })

    test('should throw BadRequest error when trying to escalate an already Escalated case', async () => {
      const parentCaseId = 'C-1'
      const childCaseId = 'C-2'
      const caseService = await getCaseService(TEST_TENANT_ID)

      const caseEscalationRequest: CaseEscalationRequest = {
        alertEscalations: [{ alertId: TEST_ALERT_1.alertId }],
        caseUpdateRequest: { reason: [] },
      }
      const alertsService = await getAlertsService(TEST_TENANT_ID)

      const parentCase: Case = {
        caseId: parentCaseId,
        caseStatus: 'OPEN',
        createdTimestamp: Date.now(),
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseHierarchyDetails: { parentCaseId: 'parent-case-id' },
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      }
      const childCase: Case = {
        caseId: childCaseId,
        caseStatus: 'ESCALATED',
        createdTimestamp: Date.now(),
        alerts: [],
        caseHierarchyDetails: { parentCaseId: parentCaseId },
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      }
      await caseService.caseRepository.addCaseMongo(parentCase)
      await caseService.caseRepository.addCaseMongo(childCase)

      await expect(
        alertsService.escalateAlerts(childCaseId, caseEscalationRequest)
      ).rejects.toThrowError(BadRequest)
    })

    test('escalate alert - update old case status to CLOSED', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await caseService.caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [],
        comments: [],
        caseType: 'SYSTEM',
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })

      await alertsService.escalateAlerts('C-2', {
        alertEscalations: [{ alertId: TEST_ALERT_1.alertId }],
        caseUpdateRequest: {
          comment: 'New comment',
          reason: ['Other'],
        },
        closeSourceCase: true,
      })

      const c = (await caseService.getCase('C-2.1')).result
      expect(c).toMatchObject({
        caseId: 'C-2.1',
        caseStatus: 'ESCALATED',
        assignments: [
          {
            assigneeUserId: 'U-1',
            timestamp: expect.any(Number),
          },
        ],
        reviewAssignments: [
          { assigneeUserId: 'ACCOUNT-1', timestamp: expect.any(Number) },
        ],
        alerts: [
          {
            ...TEST_ALERT_1,
            reviewAssignments: [
              { assigneeUserId: 'ACCOUNT-1', timestamp: expect.any(Number) },
            ],
            alertStatus: 'ESCALATED',
            statusChanges: [
              expect.objectContaining({
                caseStatus: 'ESCALATED',
                timestamp: expect.any(Number),
              }),
            ],
            lastStatusChange: expect.objectContaining({
              caseStatus: 'ESCALATED',
              timestamp: expect.any(Number),
            }),
          },
        ],
      })
      expect(c?.alerts).toHaveLength(1)
      const oldCase = (await caseService.getCase('C-2')).result
      expect(oldCase).toMatchObject({
        caseId: 'C-2',
        caseStatus: 'CLOSED',
      })
    })
  })
})

describe('Post APIs Alerts Tests', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('Single Alert Comments', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    const COMMENT_ID_1 = 'some-random-id'
    const COMMENT_ID_2 = 'some-random-id-2'

    const comment: Comment = {
      id: COMMENT_ID_1,
      body: 'some comment',
    }

    const comment2: Comment = {
      id: COMMENT_ID_2,
      body: 'some-comment-2',
    }

    await alertsService.saveComment(TEST_ALERT_1.alertId, comment)

    const c = (await caseService.getCase('C-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'OPEN',
          _id: expect.any(Number),
          caseId: 'C-1',
          comments: [
            {
              id: 'some-random-id',
              body: 'some comment',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
        },
        {
          alertId: 'A-2',
          alertStatus: 'CLOSED',
          _id: expect.any(Number),
          caseId: 'C-1',
        },
      ],
    })
    await alertsService.saveComment(TEST_ALERT_2.alertId, comment2)
    await alertsService.deleteComment(TEST_ALERT_1.alertId, COMMENT_ID_1)

    const caseAfterDeletion = (await caseService.getCase('C-1')).result

    expect(caseAfterDeletion).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'OPEN',
          _id: expect.any(Number),
          caseId: 'C-1',
          comments: [],
        },
        {
          alertId: 'A-2',
          alertStatus: 'CLOSED',
          _id: expect.any(Number),
          caseId: 'C-1',
          comments: [
            {
              id: 'some-random-id-2',
              body: 'some-comment-2',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
        },
      ],
    })
  })
  test('Two comments in a single alert only deletes a specific which is defined', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      alerts: [TEST_ALERT_1],
    })

    const COMMENT_ID_1 = 'some-random-id'
    const COMMENT_ID_2 = 'some-random-id-2'

    const comment: Comment = {
      id: COMMENT_ID_1,
      body: 'some comment',
    }

    const comment2: Comment = {
      id: COMMENT_ID_2,
      body: 'some-comment-2',
    }

    await alertsService.saveComment(TEST_ALERT_1.alertId, comment)
    await alertsService.saveComment(TEST_ALERT_1.alertId, comment2)

    const c = (await caseService.getCase('C-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          numberOfTransactionsHit: 1,
          priority: 'P1',
          _id: expect.any(Number),
          caseId: 'C-1',
          comments: [
            {
              id: 'some-random-id',
              body: 'some comment',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
            {
              id: 'some-random-id-2',
              body: 'some-comment-2',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
        },
      ],
    })

    await alertsService.deleteComment(TEST_ALERT_1.alertId, COMMENT_ID_1)

    const caseAfterDeletion = (await caseService.getCase('C-1')).result

    expect(caseAfterDeletion).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          numberOfTransactionsHit: 1,
          priority: 'P1',
          _id: expect.any(Number),
          caseId: 'C-1',
          comments: [
            {
              id: 'some-random-id-2',
              body: 'some-comment-2',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
        },
      ],
    })
  })

  test('Changing Status of a alert to Closed with Comments and Closes User Case', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertsService.updateStatus(['A-1'], {
      alertStatus: 'CLOSED',
      priority: 'P1',
      comment: 'some comment',
      otherReason: 'some other reason',
      reason: ['False positive'],
    })

    const c = (await caseService.getCase('C-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'CLOSED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          createdTimestamp: 0,
          latestTransactionArrivalTimestamp: 0,
          lastStatusChange: {
            timestamp: expect.any(Number),
            reason: ['False positive'],
            caseStatus: 'CLOSED',
            otherReason: 'some other reason',
            userId: TEST_ACCOUNT_1.id,
          },
          statusChanges: [
            {
              timestamp: expect.any(Number),
              reason: ['False positive'],
              caseStatus: 'CLOSED',
              otherReason: 'some other reason',
            },
          ],
          comments: [
            {
              body: 'Alert status changed to Closed. Reasons: False positive, some other reason\nsome comment',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
          _id: expect.any(Number),
        },
        {
          alertId: 'A-2',
          alertStatus: 'CLOSED',
          createdTimestamp: 0,
          latestTransactionArrivalTimestamp: 0,
          ruleAction: 'FLAG',
          numberOfTransactionsHit: 1,
          priority: 'P1',
          _id: expect.any(Number),
          caseId: 'C-1',
        },
      ],
      lastStatusChange: {
        userId: FLAGRIGHT_SYSTEM_USER,
        timestamp: expect.any(Number),
        reason: ['False positive'], // Changed from 'Other' to match alert's reason
        caseStatus: 'CLOSED',
        otherReason: 'some other reason', // Changed to match alert's otherReason
      },
      statusChanges: [
        {
          userId: FLAGRIGHT_SYSTEM_USER,
          timestamp: expect.any(Number),
          reason: ['False positive'], // Changed from 'Other' to match alert's reason
          caseStatus: 'CLOSED',
          otherReason: 'some other reason', // Changed to match alert's otherReason
        },
      ],
      comments: [
        {
          userId: FLAGRIGHT_SYSTEM_USER,
          body:
            'Case status changed to Closed. Reasons: False positive, some other reason\n' +
            'some comment', // Updated to reflect the specific reasons
          files: [],
          id: expect.any(String),
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      ],
    })
  })

  test('Changing Status of a Case to Closed with Comments and Does not Close User Case', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertsService.updateStatus(['A-1'], {
      alertStatus: 'CLOSED',
      priority: 'P1',
      comment: 'some comment',
      otherReason: 'some other reason',
      reason: ['False positive'],
    })

    const c = (await caseService.getCase('C-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          createdTimestamp: 0,
          latestTransactionArrivalTimestamp: 0,
          lastStatusChange: {
            timestamp: expect.any(Number),
            reason: ['False positive'],
            caseStatus: 'CLOSED',
          },
          statusChanges: [
            {
              timestamp: expect.any(Number),
              reason: ['False positive'],
              caseStatus: 'CLOSED',
            },
          ],
          comments: [
            {
              body: 'Alert status changed to Closed. Reasons: False positive, some other reason\nsome comment',
              files: [],
              createdAt: expect.any(Number),
              updatedAt: expect.any(Number),
            },
          ],
        },
        {
          alertId: 'A-3',
          alertStatus: 'OPEN',
          createdTimestamp: 0,
          latestTransactionArrivalTimestamp: 0,
          ruleAction: 'FLAG',
          numberOfTransactionsHit: 1,
          priority: 'P1',
          _id: expect.any(Number),
          caseId: 'C-1',
        },
      ],
    })
  })
  test('Assignments Test', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    const USER_ID_1 = nanoid()
    const USER_ID_2 = nanoid()

    await alertsService.updateAssignments(
      ['A-1'],
      [
        {
          assigneeUserId: USER_ID_1,
          timestamp: Date.now(),
          assignedByUserId: USER_ID_2,
        },
      ]
    )

    const c = (await caseService.getCase('C-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1',
      alerts: [
        {
          alertId: 'A-1',
          assignments: [
            {
              assigneeUserId: USER_ID_1,
              timestamp: expect.any(Number),
              assignedByUserId: USER_ID_2,
            },
          ],
        },
        {
          alertId: 'A-2',
        },
      ],
    })
  })
})

describe('Case Service - Post Api Tests', () => {
  const tenantId = getTestTenantId()

  test('Closing a case without alerts', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-2',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateStatus(['C-1-2'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      comment: 'some comment',
    })

    const c = (await caseService.getCase('C-1-2')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-2',
      createdTimestamp: expect.any(Number),
      caseStatus: 'CLOSED',
      alerts: [],
      lastStatusChange: {
        userId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        reason: ['False positive'],
        caseStatus: 'CLOSED',
        otherReason: null,
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          reason: ['False positive'],
          caseStatus: 'CLOSED',
          otherReason: null,
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-1',
          body: 'Case status changed to Closed. Reason: False positive\nsome comment',
          files: [],
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      ],
    })
  })

  test.skip('Closing a case closes all it alerts', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateStatus(['C-1-1'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      comment: 'some comment',
    })

    const c = (await caseService.getCase('C-1-1')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-1',
      createdTimestamp: expect.any(Number),
      caseStatus: 'CLOSED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-1',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive'],
            caseStatus: 'CLOSED',
            otherReason: null,
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive'],
              caseStatus: 'CLOSED',
              otherReason: null,
            },
          ],
        },
        {
          alertId: 'A-3',
          alertStatus: 'CLOSED',
          caseId: 'C-1-1',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive'],
            caseStatus: 'CLOSED',
            otherReason: null,
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive'],
              caseStatus: 'CLOSED',
              otherReason: null,
            },
          ],
        },
      ],
      lastStatusChange: {
        userId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        reason: ['False positive'],
        caseStatus: 'CLOSED',
        otherReason: null,
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          reason: ['False positive'],
          caseStatus: 'CLOSED',
          otherReason: null,
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-1',
          body: 'Case status changed to Closed. Reason: False positive\nsome comment',
          files: [],
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      ],
    })
  })

  test('Updates only Assignments', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-2',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateAssignments(
      ['C-1-2'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c = (await caseService.getCase('C-1-2')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-2',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      reviewAssignments: null,
    })
  })

  test('Updates only Review Assignments', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-3',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateReviewAssignments(
      ['C-1-3'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c = (await caseService.getCase('C-1-3')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-3',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: null,
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
    })
  })

  test('Update Case Assignments Multiple Cases Single Assignee', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-4',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      createdTimestamp: Date.now(),
      caseType: 'SYSTEM',
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateAssignments(
      ['C-1-4', 'C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c1 = (await caseService.getCase('C-1-4')).result

    expect(c1).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-4',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      reviewAssignments: null,
    })

    const c2 = (await caseService.getCase('C-1-5')).result

    expect(c2).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-5',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      reviewAssignments: null,
    })
  })

  test('Update Case Review Assignments Multiple Cases Single Assignee', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-4',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateReviewAssignments(
      ['C-1-4', 'C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c1 = (await caseService.getCase('C-1-4')).result

    expect(c1).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-4',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: null,
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
    })

    const c2 = (await caseService.getCase('C-1-5')).result

    expect(c2).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-5',
      createdTimestamp: expect.any(Number),
      caseStatus: 'OPEN',
      assignments: null,
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
    })
  })

  test.skip('Close an Case and repoepn it but alerts should not reopen', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-6',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertId: 'A-1.1',
        },
        {
          ...TEST_ALERT_3,
          alertId: 'A-3.1',
        },
      ],
      assignments: undefined,
      reviewAssignments: undefined,
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateStatus(['C-1-6'], {
      caseStatus: 'CLOSED',
      comment: 'I am closing this case',
      reason: ['False positive', 'Other'],
      otherReason: 'This is a duplicate case',
    })

    const c1 = (await caseService.getCase('C-1-6')).result

    expect(c1).toMatchObject({
      caseId: 'C-1-6',
      caseStatus: 'CLOSED',
      alerts: [
        {
          alertId: 'A-1.1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive', 'Other'],
            caseStatus: 'CLOSED',
            otherReason: 'This is a duplicate case',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive', 'Other'],
              caseStatus: 'CLOSED',
              otherReason: 'This is a duplicate case',
            },
          ],
        },
        {
          alertId: 'A-3.1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive', 'Other'],
            caseStatus: 'CLOSED',
            otherReason: 'This is a duplicate case',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive', 'Other'],
              caseStatus: 'CLOSED',
              otherReason: 'This is a duplicate case',
            },
          ],
        },
      ],
      assignments: null,
      reviewAssignments: null,
      lastStatusChange: {
        userId: TEST_ACCOUNT_1.id,
        timestamp: expect.any(Number),
        reason: ['False positive', 'Other'],
        caseStatus: 'CLOSED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: TEST_ACCOUNT_1.id,
          timestamp: expect.any(Number),
          reason: ['False positive', 'Other'],
          caseStatus: 'CLOSED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          userId: TEST_ACCOUNT_1.id,
          body: 'Case status changed to Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
        },
      ],
    })

    await caseService.updateStatus(['C-1-6'], {
      caseStatus: 'REOPENED',
      reason: ['Other'],
      otherReason: 'This is a duplicate case',
    })

    const c2 = (await caseService.getCase('C-1-6')).result

    expect(c2).toMatchObject({
      caseId: 'C-1-6',
      createdTimestamp: expect.any(Number),
      caseStatus: 'REOPENED',
      alerts: [
        {
          alertId: 'A-1.1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive', 'Other'],
            caseStatus: 'CLOSED',
            otherReason: 'This is a duplicate case',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive', 'Other'],
              caseStatus: 'CLOSED',
              otherReason: 'This is a duplicate case',
            },
          ],
        },
        {
          alertId: 'A-3.1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            timestamp: expect.any(Number),
            reason: ['False positive', 'Other'],
            caseStatus: 'CLOSED',
            otherReason: 'This is a duplicate case',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              timestamp: expect.any(Number),
              reason: ['False positive', 'Other'],
              caseStatus: 'CLOSED',
              otherReason: 'This is a duplicate case',
            },
          ],
        },
      ],
      lastStatusChange: {
        userId: TEST_ACCOUNT_1.id,
        timestamp: expect.any(Number),
        reason: ['Other'],
        caseStatus: 'REOPENED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: TEST_ACCOUNT_1.id,
          timestamp: expect.any(Number),
          reason: ['False positive', 'Other'],
          caseStatus: 'CLOSED',
          otherReason: 'This is a duplicate case',
        },
        {
          userId: TEST_ACCOUNT_1.id,
          timestamp: expect.any(Number),
          reason: ['Other'],
          caseStatus: 'REOPENED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          userId: TEST_ACCOUNT_1.id,
          body: 'Case status changed to Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
          files: [],
          id: expect.any(String),
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
        {
          userId: TEST_ACCOUNT_1.id,
          body: 'Case status changed to Reopened. Reason: This is a duplicate case',
          files: [],
          id: expect.any(String),
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      ],
    })
  })

  it('should not affect reviewAssignments when reviewAssignments are already present', async () => {
    const caseService = await getCaseService(tenantId)

    // Create a case with reviewAssignments
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    // Add assignments to the case
    await caseService.updateAssignments(
      ['C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-3',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ]
    )

    // Get the case and check that reviewAssignments are still present
    const c = (await caseService.getCase('C-1-5')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-3',
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
    })
  })

  it('should not affect assignements when assignments are already present and reviewAssigments are updated', async () => {
    const caseService = await getCaseService(tenantId)

    // Create a case with reviewAssignments
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    // Add assignments to the case
    await caseService.updateReviewAssignments(
      ['C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-3',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ]
    )

    // Get the case and check that reviewAssignments are still present
    const c = (await caseService.getCase('C-1-5')).result

    expect(c).toMatchObject({
      _id: expect.any(ObjectId),
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-3',
          timestamp: expect.any(Number),
          assignedByUserId: 'ACCOUNT-2',
        },
      ],
    })
  })
})

describe('Test Review Approvals Send Back Flow', () => {
  const tenantId = getTestTenantId()

  it('Should Send a Case To In Review when closed', async () => {
    const caseService = await getCaseService(tenantId)
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'admin' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await caseService.updateStatus(['C-1-5'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })
    const c = (await caseService.getCase('C-1-5')).result
    expect(c).toMatchObject({
      caseId: 'C-1-5',
      caseStatus: 'IN_REVIEW_CLOSED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'IN_REVIEW_CLOSED',
          caseId: 'C-1-5',
          comments: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\nI am closing this case',
              files: [],
            },
          ],
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: ['Other'],
            caseStatus: 'IN_REVIEW_CLOSED',
            otherReason:
              'Case of this alert was In Review Requested to be Closed',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_CLOSED',
              otherReason:
                'Case of this alert was In Review Requested to be Closed',
            },
          ],
        },
        {
          alertId: 'A-2',
          alertStatus: 'CLOSED',
          caseId: 'C-1-5',
        },
      ],
      lastStatusChange: {
        userId: REVIEWEE.id,
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: REVIEWEE.id,
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
          files: [],
          userId: REVIEWEE.id,
        },
      ],
    })
  })

  it('Should Send a Case To In Review when Escalated', async () => {
    const caseService = await getCaseService(tenantId)
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'admin' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await caseService.escalateCase('C-1-5', {
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ],
      reason: ['False positive'],
      caseStatus: 'ESCALATED',
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
      reviewAssignments: [
        {
          assigneeUserId: 'ACCOUNT-3',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ],
    })

    const c = (await caseService.getCase('C-1-5')).result
    expect(c).toMatchObject({
      caseId: 'C-1-5',
      caseStatus: 'IN_REVIEW_ESCALATED',
      reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'IN_REVIEW_ESCALATED',
          caseId: 'C-1-5',
          comments: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert status changed to In Review and is requested to be Escalated. Reasons: Case of this alert was In Review Requested to be Escalated\nI am closing this case',
              files: [],
            },
          ],
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: ['Other'],
            caseStatus: 'IN_REVIEW_ESCALATED',
            otherReason:
              'Case of this alert was In Review Requested to be Escalated',
          },
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_ESCALATED',
              otherReason:
                'Case of this alert was In Review Requested to be Escalated',
            },
          ],
        },
        {
          alertId: 'A-2',
          alertStatus: 'CLOSED',
          caseId: 'C-1-5',
        },
      ],
      lastStatusChange: {
        userId: REVIEWEE.id,
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_ESCALATED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: REVIEWEE.id,
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_ESCALATED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Escalated. Reasons: False positive, This is a duplicate case\nI am closing this case',
          files: [],
          userId: REVIEWEE.id,
        },
      ],
    })
  })

  test.skip('Reviewer chooses to Approve whole Open case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-5'
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })

    const c = (await caseService.getCase(caseId)).result
    expect(c?.caseStatus).toBe('IN_REVIEW_CLOSED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_CLOSED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    expect(c?.alerts?.[0]).toMatchObject({
      lastStatusChange: {
        userId: FLAGRIGHT_SYSTEM_USER,
        reason: ['Other'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'Case of this alert was In Review Requested to be Closed',
      },
      statusChanges: [
        {
          userId: FLAGRIGHT_SYSTEM_USER,
          reason: ['Other'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason:
            'Case of this alert was In Review Requested to be Closed',
        },
      ],
      comments: [
        {
          userId: FLAGRIGHT_SYSTEM_USER,
          body:
            'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\n' +
            'I am closing this case',
        },
      ],
    })
    await caseService.updateStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: [],
    })
    const c2 = (await caseService.getCase(caseId)).result
    expect(c2?.caseStatus).toBe('CLOSED')
    expect(c2).toMatchObject({
      caseId: 'C-1-5',
      caseStatus: 'CLOSED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-5',
          comments: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\nI am closing this case',
            },
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert is Approved and its status is changed to Closed',
            },
          ],
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: [],
            caseStatus: 'CLOSED',
            otherReason: null,
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_CLOSED',
              otherReason:
                'Case of this alert was In Review Requested to be Closed',
            },
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: [],
              caseStatus: 'CLOSED',
              otherReason: null,
            },
          ],
        },
        { alertId: 'A-2', alertStatus: 'CLOSED', caseId: 'C-1-5' },
      ],
      lastStatusChange: {
        userId: REVIEWEE.id,
        reason: [],
        caseStatus: 'CLOSED',
      },
      statusChanges: [
        {
          userId: REVIEWEE.id,
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate case',
        },
        {
          userId: REVIEWEE.id,
          reason: [],
          caseStatus: 'CLOSED',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
          userId: REVIEWEE.id,
        },
        {
          body: 'Case is Approved and its status is changed to Closed.',
          userId: REVIEWEE.id,
        },
      ],
    })
  })

  test('Reviewer chooses to Send Back the whole case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-6'
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await caseService.updateStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })
    await caseService.updateStatus([caseId], {
      caseStatus: 'OPEN',
      reason: [],
    })
    const c = (await caseService.getCase(caseId)).result
    expect(c?.caseStatus).toBe('OPEN')
  })

  test('Reviewer chooses to Approve the whole Escalated case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-6'
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWER' },
    })
    const alertId1 = nanoid()
    const alertId2 = nanoid()
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertId: alertId1,
        },
        {
          ...TEST_ALERT_2,
          alertId: alertId2,
        },
      ],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      assignments: [
        {
          assignedByUserId: 'ACCOUNT-3',
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
        },
      ],
    })

    await caseService.escalateCase(caseId, {
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
      caseStatus: 'ESCALATED',
      reviewAssignments: [
        {
          assignedByUserId: 'ACCOUNT-3',
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
        },
      ],
    })
    const c = (await caseService.getCase(caseId)).result
    expect(c?.caseStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    await caseService.escalateCase(caseId, {
      reason: [],
    })

    const c2 = (await caseService.getCase(caseId)).result
    expect(c2).toMatchObject({
      caseId: 'C-1-6',
      caseStatus: 'ESCALATED',
      alerts: [
        {
          alertId: alertId1,
          alertStatus: 'ESCALATED',
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: ['Other'],
            caseStatus: 'ESCALATED',
            otherReason: 'Case of this alert was Escalated',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_ESCALATED',
              otherReason:
                'Case of this alert was In Review Requested to be Escalated',
            },
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'ESCALATED',
              otherReason: 'Case of this alert was Escalated',
            },
          ],
          comments: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert status changed to In Review and is requested to be Escalated. Reasons: Case of this alert was In Review Requested to be Escalated\nI am closing this case',
            },
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              body: 'Alert is Approved and its status is changed to Escalated. Reasons: Case of this alert was Escalated',
            },
          ],
        },
        { alertId: alertId2, alertStatus: 'CLOSED' },
      ],
      assignments: [{ assigneeUserId: 'ACCOUNT-3' }],
      reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
      lastStatusChange: {
        userId: 'ACCOUNT-3',
        reason: [],
        caseStatus: 'ESCALATED',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_ESCALATED',
          otherReason: 'This is a duplicate case',
        },
        {
          userId: 'ACCOUNT-3',
          reason: [],
          caseStatus: 'ESCALATED',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Escalated. Reasons: False positive, This is a duplicate case\nI am closing this case',
          userId: 'ACCOUNT-3',
        },
        {
          body: 'Case is Approved and its status is changed to Escalated.',
          userId: 'ACCOUNT-3',
        },
      ],
    })
  })

  test('Reviewer chooses to Send Back the whole Escalated case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-7'
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertId: 'A-1.1',
        },
        {
          ...TEST_ALERT_2,
          alertId: 'A-2.1',
        },
      ],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await caseService.escalateCase(caseId, {
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
      caseStatus: 'ESCALATED',
      assignments: [
        {
          assignedByUserId: 'ACCOUNT-3',
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
        },
      ],
      reviewAssignments: [
        {
          assignedByUserId: 'ACCOUNT-3',
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
        },
      ],
    })
    const c = (await caseService.getCase(caseId)).result
    expect(c?.caseStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    await caseService.updateStatus([caseId], {
      caseStatus: 'OPEN',
      reason: [],
    })
    const c2 = (await caseService.getCase(caseId)).result
    expect(c2).toMatchObject({
      caseId: 'C-1-7',
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1.1',
          alertStatus: 'OPEN',
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          lastStatusChange: {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: ['Other'],
            caseStatus: 'OPEN',
            otherReason: 'Case of this alert was Open',
          },
          statusChanges: [
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_ESCALATED',
              otherReason:
                'Case of this alert was In Review Requested to be Escalated',
            },
            {
              userId: FLAGRIGHT_SYSTEM_USER,
              reason: ['Other'],
              caseStatus: 'OPEN',
              otherReason: 'Case of this alert was Open',
            },
          ],
        },
        { alertId: 'A-2.1', alertStatus: 'CLOSED' },
      ],
      assignments: [{ assigneeUserId: 'ACCOUNT-3' }],
      reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
    })
  })

  test('Alert status is changed to IN_REVIEW when reviewer chooses to close the alert', async () => {
    const caseService = await getCaseService(tenantId)
    const alertsService = await getAlertsService(tenantId)
    const caseId = 'C-1-8'
    const testAlertId = nanoid()
    const testAlertId2 = nanoid()
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertStatus: 'OPEN',
          alertId: testAlertId,
        },
        {
          ...TEST_ALERT_2,
          alertStatus: 'CLOSED',
          alertId: testAlertId2,
        },
      ],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await alertsService.updateStatus([testAlertId], {
      alertStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate alert',
      comment: 'I am closing this alert',
    })
    const a = (await alertsService.getAlert(testAlertId)).result
    expect(a?.alertStatus).toBe('IN_REVIEW_CLOSED')
    const a2 = (await alertsService.getAlert(testAlertId2)).result
    expect(a2?.alertStatus).toBe('CLOSED')
    expect(a).toMatchObject({
      alertStatus: 'IN_REVIEW_CLOSED',
      caseId: 'C-1-8',
      lastStatusChange: {
        userId: 'ACCOUNT-3',
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'This is a duplicate alert',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate alert',
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-3',
          body:
            'Alert status changed to In Review and is requested to be Closed. Reasons: False positive, This is a duplicate alert\n' +
            'I am closing this alert',
        },
      ],
    })
  })

  test.skip('Alerts Partial Escaltaion', async () => {
    const caseService = await getCaseService(tenantId)
    const alertsService = await getAlertsService(tenantId)

    const caseId = nanoid()
    const caseId2 = nanoid()
    const testAlertIds = [nanoid(), nanoid(), nanoid(), nanoid()]
    const closedTestAlertId = nanoid()

    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })

    const testAlerts = testAlertIds
      .map((alertId) => ({
        ...TEST_ALERT_1,
        alertStatus: 'OPEN' as AlertStatus,
        alertId,
      }))
      .concat({
        ...TEST_ALERT_1,
        alertStatus: 'CLOSED' as AlertStatus,
        alertId: closedTestAlertId,
      })

    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: cloneDeep(testAlerts),
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertsService.escalateAlerts(caseId, {
      alertEscalations: testAlertIds.slice(0, 2).map((alertId) => ({
        alertId,
        transactionIds: [],
      })),
      caseUpdateRequest: {
        reason: ['False positive'],
        comment: 'I am closing this case',
      },
    })
    const c = (await caseService.getCase(caseId)).result
    expect(c?.caseStatus).toBe('OPEN')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[2]?.alertStatus).toBe('OPEN')
    expect(c?.alerts?.[3]?.alertStatus).toBe('OPEN')
    expect(c?.alerts?.[4]?.alertStatus).toBe('CLOSED')

    await caseService.caseRepository.addCaseMongo({
      caseId: caseId2,
      caseStatus: 'OPEN',
      alerts: cloneDeep(testAlerts).map((alert) => ({
        ...alert,
        alertId: alert.alertId + '2',
      })),
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertsService.escalateAlerts(caseId2, {
      alertEscalations: testAlertIds.slice(0, 2).map((alertId) => ({
        alertId: alertId + '2',
        transactionIds: [],
      })),
      caseUpdateRequest: {
        reason: ['False positive'],
        comment: 'I am closing this case',
        caseStatus: 'CLOSED',
      },
    })

    const c2 = (await caseService.getCase(caseId2)).result

    expect(c2?.caseStatus).toBe('IN_REVIEW_CLOSED')
    Array.from({ length: 2 }).forEach((_, i) => {
      expect(c2?.alerts?.[i]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    })
    Array.from({ length: 2 }).forEach((_, i) => {
      expect(c2?.alerts?.[i + 2]?.alertStatus).toBe('IN_REVIEW_CLOSED')
    })
    expect(c2?.alerts?.[4]?.alertStatus).toBe('CLOSED')
    await alertsService.escalateAlerts(caseId2, {
      alertEscalations: [
        { alertId: testAlertIds[0] + '2', transactionIds: [] },
      ],
      caseUpdateRequest: { reason: [] },
    })
    const c3 = (await caseService.getCase(caseId2)).result
    expect(c3?.caseStatus).toBe('IN_REVIEW_CLOSED')
    expect(c3?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    Array.from({ length: 2 }).forEach((_, i) => {
      expect(c3?.alerts?.[i + 1]?.alertStatus).toBe('IN_REVIEW_CLOSED')
    })
    expect(c3?.alerts?.[3]?.alertStatus).toBe('CLOSED')
    const c4 = (await caseService.getCase(`${caseId2}.1`)).result
    expect(c4?.caseStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c4?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    await alertsService.updateStatus([testAlertIds[1]], {
      alertStatus: 'OPEN',
      reason: [],
    })
    const c5 = (await caseService.getCase(caseId)).result
    expect(c5?.caseStatus).toBe('OPEN')
    expect(c5?.alerts?.[1]?.alertStatus).toBe('OPEN')
    expect(c5?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    await caseService.updateStatus([caseId2], {
      reason: [],
      caseStatus: 'CLOSED',
    })
    const c6 = (await caseService.getCase(caseId2)).result
    expect(c6?.caseStatus).toBe('CLOSED')
    Array.from({ length: 3 }).forEach((_, i) => {
      expect(c6?.alerts?.[i]?.alertStatus).toBe('CLOSED')
    })
  })
})

describe('Case/Alerts Service - Status Change Tests', () => {
  const tenantId = nanoid()

  test('Case Status Change - In review closed to closed', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = nanoid()

    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })

    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseType: 'MANUAL',
      caseStatus: 'IN_REVIEW_CLOSED',
      alerts: [TEST_ALERT_1],
      statusChanges: [
        {
          userId: 'TEST_IN_REVIEW_USER',
          caseStatus: 'IN_REVIEW_CLOSED',
          reason: ['False positive'],
          timestamp: Date.now(),
        },
      ],
      lastStatusChange: {
        userId: 'TEST_IN_REVIEW_USER',
        caseStatus: 'IN_REVIEW_CLOSED',
        reason: ['False positive'],
        timestamp: Date.now(),
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.updateStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
    })

    const updatedCase = (await caseService.getCase(caseId)).result
    expect(updatedCase).toMatchObject({
      caseStatus: 'CLOSED',
      statusChanges: [
        {
          userId: 'TEST_IN_REVIEW_USER',
          caseStatus: 'IN_REVIEW_CLOSED',
          reason: expect.any(Array),
          timestamp: expect.any(Number),
        },
        {
          userId: 'TEST_IN_REVIEW_USER',
          timestamp: expect.any(Number),
          reason: expect.any(Array),
          caseStatus: 'CLOSED',
          otherReason: null,
          reviewerId: 'ACCOUNT-3',
        },
      ],
      lastStatusChange: {
        userId: 'TEST_IN_REVIEW_USER',
        caseStatus: 'CLOSED',
        reason: expect.any(Array),
        timestamp: expect.any(Number),
        otherReason: null,
        reviewerId: 'ACCOUNT-3',
      },
      updatedAt: expect.any(Number),
    })
  })

  test('Closing case with updating users should update user data in case', async () => {
    const userRepository = await getUsersRepository(tenantId)
    const caseService = await getCaseService(tenantId)
    const caseId1 = nanoid()
    const caseId2 = nanoid()

    const savedUser1 = await userRepository.saveUser(
      getTestUser({
        userStateDetails: {
          state: 'ACTIVE',
        },
      }),
      'CONSUMER'
    )
    const savedUser2 = await userRepository.saveUser(
      getTestUser({
        userStateDetails: {
          state: 'ACTIVE',
        },
      }),
      'CONSUMER'
    )

    for (const caseId of [caseId1, caseId2]) {
      await caseService.caseRepository.addCaseMongo({
        caseId: caseId,
        caseType: 'MANUAL',
        caseStatus: 'OPEN',
        caseUsers:
          caseId === caseId1
            ? {
                origin: savedUser1,
                destination: undefined,
              }
            : {
                origin: undefined,
                destination: savedUser2,
              },
        alerts: [TEST_ALERT_1],
        statusChanges: [
          {
            userId: 'TEST_IN_REVIEW_USER',
            caseStatus: 'IN_REVIEW_CLOSED',
            reason: ['False positive'],
            timestamp: Date.now(),
          },
        ],
        lastStatusChange: {
          userId: 'TEST_IN_REVIEW_USER',
          caseStatus: 'IN_REVIEW_CLOSED',
          reason: ['False positive'],
          timestamp: Date.now(),
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
    }

    await caseService.updateStatus([caseId1, caseId2], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      userStateDetails: {
        state: 'TERMINATED',
        reason: 'Testing',
      },
    })

    // Check that users are updated
    {
      const u1 = await userRepository.getUser<InternalConsumerUser>(
        savedUser1.userId
      )
      const u2 = await userRepository.getUser<InternalConsumerUser>(
        savedUser2.userId
      )
      expect(u1?.userStateDetails?.state).toBe('TERMINATED')
      expect(u2?.userStateDetails?.state).toBe('TERMINATED')
    }

    // Check that user in case is updated
    {
      const case1 = (await caseService.getCase(caseId1)).result
      expect(
        (case1?.caseUsers?.origin as InternalConsumerUser)?.userStateDetails
          ?.state
      ).toBe('TERMINATED')
      const case2 = (await caseService.getCase(caseId2)).result
      expect(
        (case2?.caseUsers?.destination as InternalConsumerUser)
          ?.userStateDetails?.state
      ).toBe('TERMINATED')
    }
  })

  test('Changing user data should change it in the case too', async () => {
    const userRepository = await getUsersRepository(tenantId)
    const userService = await getUsersService(tenantId)
    const caseService = await getCaseService(tenantId)
    const caseId1 = nanoid()
    const caseId2 = nanoid()

    const savedUser1 = await userRepository.saveUser(
      getTestUser({
        userStateDetails: {
          state: 'ACTIVE',
        },
      }),
      'CONSUMER'
    )
    const savedUser2 = await userRepository.saveUser(
      getTestUser({
        userStateDetails: {
          state: 'ACTIVE',
        },
      }),
      'CONSUMER'
    )

    for (const caseId of [caseId1, caseId2]) {
      await caseService.caseRepository.addCaseMongo({
        caseId: caseId,
        caseType: 'MANUAL',
        caseStatus: 'OPEN',
        caseUsers:
          caseId === caseId1
            ? {
                origin: savedUser1,
                destination: undefined,
              }
            : {
                origin: undefined,
                destination: savedUser2,
              },
        alerts: [TEST_ALERT_1],
        statusChanges: [
          {
            userId: 'TEST_IN_REVIEW_USER',
            caseStatus: 'IN_REVIEW_CLOSED',
            reason: ['False positive'],
            timestamp: Date.now(),
          },
        ],
        lastStatusChange: {
          userId: 'TEST_IN_REVIEW_USER',
          caseStatus: 'IN_REVIEW_CLOSED',
          reason: ['False positive'],
          timestamp: Date.now(),
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
    }

    // Update users
    await userService.updateUser(savedUser1, {
      userStateDetails: {
        state: 'TERMINATED',
        reason: 'Testing',
      },
    })
    await userService.updateUser(savedUser2, {
      userStateDetails: {
        state: 'TERMINATED',
        reason: 'Testing',
      },
    })

    // Check that users are updated
    {
      const u1 = await userRepository.getUser<InternalConsumerUser>(
        savedUser1.userId
      )
      const u2 = await userRepository.getUser<InternalConsumerUser>(
        savedUser2.userId
      )
      expect(u1?.userStateDetails?.state).toBe('TERMINATED')
      expect(u2?.userStateDetails?.state).toBe('TERMINATED')
    }

    // Check that user in case is updated
    {
      const case1 = (await caseService.getCase(caseId1)).result
      expect(
        (case1?.caseUsers?.origin as InternalConsumerUser)?.userStateDetails
          ?.state
      ).toBe('TERMINATED')
      const case2 = (await caseService.getCase(caseId2)).result
      expect(
        (case2?.caseUsers?.destination as InternalConsumerUser)
          ?.userStateDetails?.state
      ).toBe('TERMINATED')
    }
  })

  test('Alerts Status Change - In review closed to closed', async () => {
    const caseService = await getCaseService(tenantId)
    const alertService = await getAlertsService(tenantId)
    const caseId = nanoid()
    const alertId = nanoid()

    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })

    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'CLOSED',
      caseType: 'MANUAL',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertId,
          alertStatus: 'IN_REVIEW_CLOSED',
          statusChanges: [
            {
              userId: 'TEST_IN_REVIEW_USER',
              caseStatus: 'IN_REVIEW_CLOSED',
              reason: ['False positive'],
              timestamp: Date.now(),
            },
          ],
          lastStatusChange: {
            userId: 'TEST_IN_REVIEW_USER',
            caseStatus: 'IN_REVIEW_CLOSED',
            reason: ['False positive'],
            timestamp: Date.now(),
          },
        },
      ],
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertService.updateStatus([alertId], {
      alertStatus: 'CLOSED',
      reason: ['False positive'],
    })

    const alert = (await alertService.getAlert(alertId)).result
    expect(alert).toMatchObject({
      alertId,
      alertStatus: 'CLOSED',
      createdTimestamp: 0,
      latestTransactionArrivalTimestamp: 0,
      ruleInstanceId: 'rid-131',
      ruleName: '',
      ruleDescription: '',
      ruleId: '',
      ruleAction: 'FLAG',
      numberOfTransactionsHit: 1,
      priority: 'P1',
      statusChanges: [
        {
          userId: 'TEST_IN_REVIEW_USER',
          caseStatus: 'IN_REVIEW_CLOSED',
          reason: expect.any(Array),
          timestamp: expect.any(Number),
        },
        {
          userId: 'ACCOUNT-3',
          timestamp: expect.any(Number),
          reason: expect.any(Array),
          caseStatus: 'CLOSED',
          otherReason: null,
          reviewerId: null,
        },
      ],
      lastStatusChange: {
        userId: 'ACCOUNT-3',
        timestamp: expect.any(Number),
        reason: ['False positive'],
        caseStatus: 'CLOSED',
        otherReason: null,
        reviewerId: null,
      },
      caseId,
      updatedAt: expect.any(Number),
    })
  })
})

describe('Test Cases Reassignment', () => {
  const tenantId = getTestTenantId()

  test('Case Assignments', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = nanoid()
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseType: 'MANUAL',
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-1',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ],
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await caseService.caseRepository.reassignCases('ACCOUNT-1', 'ACCOUNT-3')

    const updatedCase = (await caseService.getCase(caseId)).result

    expect(updatedCase?.assignments).toEqual([
      {
        assigneeUserId: 'ACCOUNT-3',
        assignedByUserId: expect.any(String),
        timestamp: expect.any(Number),
      },
    ])
  })
})

describe('Test Alerts Reassignment', () => {
  const tenantId = getTestTenantId()

  test('Case Assignments', async () => {
    const caseService = await getCaseService(tenantId)
    const alertService = await getAlertsService(tenantId)
    const caseId = nanoid()
    const alertId = nanoid()
    const alertId2 = nanoid()
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseType: 'MANUAL',
      alerts: [
        {
          ...TEST_ALERT_1,
          alertId,
          assignments: [
            {
              assigneeUserId: 'ACCOUNT-1',
              assignedByUserId: 'ACCOUNT-2',
              timestamp: Date.now(),
            },
          ],
        },
        {
          ...TEST_ALERT_1,
          alertId: alertId2,
          assignments: [
            {
              assigneeUserId: 'ACCOUNT-4',
              assignedByUserId: 'ACCOUNT-2',
              timestamp: Date.now(),
            },
          ],
        },
      ],
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await alertService.alertsRepository.reassignAlerts('ACCOUNT-1', 'ACCOUNT-3')

    const updatedCase = (await caseService.getCase(caseId)).result

    expect(updatedCase?.alerts?.[0]?.assignments).toEqual([
      {
        assigneeUserId: 'ACCOUNT-3',
        assignedByUserId: expect.any(String),
        timestamp: expect.any(Number),
      },
    ])

    expect(updatedCase?.alerts?.[1]?.assignments).toEqual([
      {
        assigneeUserId: 'ACCOUNT-4',
        assignedByUserId: expect.any(String),
        timestamp: expect.any(Number),
      },
    ])
  })
})

describe('Test alert should reopen if qa status is failed', () => {
  test('should reopen alert if qa status is failed', async () => {
    const testTenantId = getTestTenantId()
    const case_: Case = {
      caseType: 'SYSTEM',
      caseAggregates: {
        destinationPaymentMethods: [],
        originPaymentMethods: [],
        tags: [],
      },
      caseStatus: 'OPEN',
      caseId: 'C-1-5',
      alerts: [
        {
          alertId: 'AL-1234',
          alertStatus: 'CLOSED',
          priority: 'P1',
          createdTimestamp: Date.now(),
          numberOfTransactionsHit: 5,
          ruleAction: 'ALLOW',
          ruleDescription: 'Allow all transactions',
          ruleInstanceId: 'I-1234',
          ruleName: 'Allow all transactions',
        },
      ],
    }

    const mongoDb = await getMongoDbClient()

    const caseRepository = new CaseRepository(testTenantId, {
      mongoDb,
      dynamoDb: getDynamoDbClient(),
    })
    await caseRepository.addCaseMongo(case_)
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })
    const alertsService = await getAlertsService(testTenantId)
    await alertsService.updateAlertQaStatus({
      alertIds: ['AL-1234'],
      checklistStatus: 'FAILED',
      reason: ['Other'],
    })

    const updatedAlert = (await alertsService.getAlert('AL-1234')).result

    expect(updatedAlert?.alertStatus).toBe('REOPENED')
  })
})

describe('Test case escalation l2', () => {
  withFeatureHook(['MULTI_LEVEL_ESCALATION', 'ADVANCED_WORKFLOWS'])
  const testTenantId = getTestTenantId()
  test('should escalate case to l2 if l1 is not assigned', async () => {
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })
    // create a case
    const caseService = await getCaseService(testTenantId)
    const caseId = nanoid()
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseType: 'SYSTEM',
      caseStatus: 'OPEN',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
      assignments: [
        {
          assigneeUserId: 'ACCOUNT-3',
          assignedByUserId: 'ACCOUNT-2',
          timestamp: Date.now(),
        },
      ],
    })

    // escalate case
    await caseService.escalateCase(caseId, {
      caseStatus: 'ESCALATED',
      reason: ['Other'],
    })

    const updatedCase = (await caseService.getCase(caseId)).result
    expect(updatedCase?.caseStatus).toBe('IN_REVIEW_ESCALATED')

    getContextMocker.mockReturnValue({
      user: TEST_ACCOUNT_1,
    })

    // approve case
    await caseService.escalateCase(caseId, {
      caseStatus: 'ESCALATED',
      reason: ['Other'],
    })

    const updatedCase2 = (await caseService.getCase(caseId)).result
    expect(updatedCase2?.caseStatus).toBe('ESCALATED')
    expect(updatedCase2?.reviewAssignments).toMatchObject([
      {
        assigneeUserId: 'ACCOUNT-1',
        assignedByUserId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        escalationLevel: 'L1',
      },
    ])

    getContextMocker.mockReturnValue({
      user: TEST_ACCOUNT_1,
    })

    await caseService.escalateCase(caseId, {
      caseStatus: 'ESCALATED',
      reason: ['Other'],
    })

    const updatedCase3 = (await caseService.getCase(caseId)).result
    expect(updatedCase3?.caseStatus).toBe('ESCALATED_L2')
    expect(
      updatedCase3?.reviewAssignments?.find(
        (assignment) => assignment.escalationLevel === 'L2'
      )?.assigneeUserId
    ).toBe('ACCOUNT-4')
  })
})

describe('Test no double escalation review', () => {
  withFeatureHook(['MULTI_LEVEL_ESCALATION', 'ADVANCED_WORKFLOWS'])
  const testTenantId = getTestTenantId()
  test('should not double escalate review', async () => {
    const caseService = await getCaseService(testTenantId)
    const alertService = await getAlertsService(testTenantId)
    const caseId = nanoid()
    getContextMocker.mockReturnValue({
      user: { id: REVIEWEE.id, role: 'REVIEWEE' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseType: 'SYSTEM',
      caseStatus: 'OPEN',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      alerts: [TEST_ALERT_1, TEST_ALERT_2, TEST_ALERT_3],
    })

    await alertService.updateStatus([TEST_ALERT_1.alertId], {
      alertStatus: 'CLOSED',
      reason: ['Other'],
    })

    const alert = (await alertService.getAlert(TEST_ALERT_1.alertId)).result
    expect(alert?.alertStatus).toBe('IN_REVIEW_CLOSED')

    getContextMocker.mockReturnValue({
      user: TEST_ACCOUNT_1,
    })

    await alertService.updateStatus([TEST_ALERT_1.alertId], {
      alertStatus: 'OPEN',
      reason: ['Other'],
    })

    const updatedAlert = (await alertService.getAlert(TEST_ALERT_1.alertId))
      .result
    expect(updatedAlert?.alertStatus).toBe('OPEN')

    await alertService.escalateAlerts(caseId, {
      alertEscalations: [{ alertId: TEST_ALERT_1.alertId, transactionIds: [] }],
      caseUpdateRequest: {
        caseStatus: 'ESCALATED',
        reason: ['Other'],
      },
    })

    const updatedCase = (await caseService.getCase(caseId)).result
    const childCaseId =
      updatedCase?.caseHierarchyDetails?.childCaseIds?.[0] || ''

    const childCase = (await caseService.getCase(childCaseId)).result
    expect(childCase?.caseStatus).toBe('ESCALATED')
    expect(childCase?.reviewAssignments).toMatchObject([
      {
        assigneeUserId: 'ACCOUNT-1',
        assignedByUserId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        escalationLevel: 'L1',
      },
    ])
  })
})
