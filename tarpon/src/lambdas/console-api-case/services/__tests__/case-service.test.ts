import { NotFound, BadRequest } from 'http-errors'
import { cloneDeep } from 'lodash'
import dayjs from 'dayjs'
import { ObjectId } from 'mongodb'
import { nanoid } from 'nanoid'
import { CaseService } from '../case-service'
import { CASE_TRANSACTIONS } from './utils/case-transactions'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Account } from '@/services/accounts'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { AlertsService } from '@/services/alerts'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '@/services/rules-engine/repositories/alerts-repository'
import { getS3ClientByEvent } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import * as Context from '@/core/utils/context'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const TEST_ACCOUNT_1: Account = {
  id: 'ACCOUNT-1',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'ACCOUNT-1',
  blocked: false,
  isEscalationContact: true,
}

const TEST_ACCOUNT_2: Account = {
  id: 'ACCOUNT-2',
  role: 'analyst',
  email: 'abc@email.com',
  emailVerified: true,
  name: 'ACCOUNT-2',
  blocked: false,
  isEscalationContact: false,
}

const TEST_ACCOUNT_3: Account = {
  id: 'ACCOUNT-3',
  role: 'admin',
  email: 'abcd@email.com',
  emailVerified: true,
  name: 'ACCOUNT-3',
  blocked: false,
  isEscalationContact: false,
  reviewerId: 'ACCOUNT-1',
}

const CASE_TRANSACTION_IDS = ['T-1', 'T-2', 'T-3', 'T-4']

const TEST_ALERT_1: Alert = {
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

const TEST_ALERT_2: Alert = {
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

withFeatureHook(['ESCALATION'])

jest.mock('@/services/accounts', () => {
  const originalModule = jest.requireActual<
    typeof import('@/services/accounts')
  >('@/services/accounts')
  return {
    ...originalModule,
    __esModule: true,
    AccountsService: jest.fn().mockImplementation(() => {
      return {
        getAllActiveAccounts: jest.fn().mockImplementation(() => {
          return [TEST_ACCOUNT_1, TEST_ACCOUNT_2, TEST_ACCOUNT_3]
        }),
        getAccount: jest.fn().mockImplementation((accountId: string) => {
          if (accountId === TEST_ACCOUNT_1.id) {
            return TEST_ACCOUNT_1
          } else if (accountId === TEST_ACCOUNT_2.id) {
            return TEST_ACCOUNT_2
          } else if (accountId === TEST_ACCOUNT_3.id) {
            return TEST_ACCOUNT_3
          }
        }),
      }
    }),
  }
})

jest.mock('@/core/utils/context', () => {
  const originalModule = jest.requireActual<
    typeof import('@/core/utils/context')
  >('@/core/utils/context')

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
  const s3 = getS3ClientByEvent(null as any)
  const caseRepository = new CaseRepository(tenantId, {
    mongoDb,
  })
  const caseService = new CaseService(caseRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })

  return caseService
}

async function getAlertsService(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const s3 = getS3ClientByEvent(null as any)
  const alertsRepository = new AlertsRepository(tenantId, {
    mongoDb,
  })

  const alertsService = new AlertsService(alertsRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })

  return alertsService
}

const getContextMocker = jest.spyOn(Context, 'getContext')

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
      })

      await caseService.escalateCase('C-1', {
        comment: 'test comment',
        reason: ['Documents collected'],
      })

      const c = await caseService.getCase('C-1')

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
        reviewAssignments: [{ assigneeUserId: 'U-2', timestamp: t }],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
      })
      await caseService.escalateCase('C-2', { reason: ['Documents collected'] })
      const c = await caseService.getCase('C-2')
      expect(c).toMatchObject({
        caseId: 'C-2',
        reviewAssignments: [{ assigneeUserId: 'U-2', timestamp: t }],
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
        caseTransactions: CASE_TRANSACTIONS,
        caseHierarchyDetails: {
          childTransactionIds: ['T-101'],
        },
      })

      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await alertsService.escalateAlerts('C-2', {
        alertEscalations: [
          { alertId: TEST_ALERT_1.alertId!, transactionIds: [] },
        ],
      })

      const c = await caseService.getCase('C-2.1')
      expect(c).toMatchObject({
        caseId: 'C-2.1',
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: expect.any(Number) }],
        reviewAssignments: [
          { assigneeUserId: 'ACCOUNT-1', timestamp: expect.any(Number) },
        ],
        caseHierarchyDetails: {
          parentCaseId: 'C-2',
        },
        alerts: [
          {
            ...TEST_ALERT_1,
            alertId: `${TEST_ALERT_1.alertId}`,
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
      const oldCase = await caseService.getCase('C-2')
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
        alertsService.escalateAlerts(null as unknown as string, {})
      ).rejects.toThrow(NotFound)
    })

    test('escalateAlerts throws error if caseId is undefined', async () => {
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await expect(
        alertsService.escalateAlerts(undefined as unknown as string, {})
      ).rejects.toThrow(NotFound)
    })

    test('should throw BadRequest error when trying to escalate an already Escalated case', async () => {
      const parentCaseId = 'C-1'
      const childCaseId = 'C-2'
      const caseService = await getCaseService(TEST_TENANT_ID)

      const caseEscalationRequest: CaseEscalationRequest = {
        alertEscalations: [{ alertId: TEST_ALERT_1.alertId! }],
      }
      const alertsService = await getAlertsService(TEST_TENANT_ID)

      const parentCase: Case = {
        caseId: parentCaseId,
        caseStatus: 'OPEN',
        createdTimestamp: Date.now(),
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
        caseHierarchyDetails: { parentCaseId: 'parent-case-id' },
      }
      const childCase: Case = {
        caseId: childCaseId,
        caseStatus: 'ESCALATED',
        createdTimestamp: Date.now(),
        alerts: [],
        caseHierarchyDetails: { parentCaseId: parentCaseId },
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
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
      })

      await alertsService.escalateAlerts('C-2', {
        alertEscalations: [{ alertId: TEST_ALERT_1.alertId! }],
        caseUpdateRequest: {
          caseStatus: 'CLOSED',
          comment: 'New comment',
          reason: ['Other'],
        },
      })

      const c = await caseService.getCase('C-2.1')
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
      const oldCase = await caseService.getCase('C-2')
      expect(oldCase).toMatchObject({
        caseId: 'C-2',
        caseStatus: 'CLOSED',
      })
    })
  })
})

describe('Post APIs Alerts Tests', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('Single ALert Comments', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
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

    await alertsService.saveAlertComment(TEST_ALERT_1.alertId!, comment)

    const c = await caseService.getCase('C-1')

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
    await alertsService.saveAlertComment(TEST_ALERT_2.alertId!, comment2)
    await alertsService.deleteAlertComment(TEST_ALERT_1.alertId!, COMMENT_ID_1)

    const caseAfterDeletion = await caseService.getCase('C-1')

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

    await alertsService.saveAlertComment(TEST_ALERT_1.alertId!, comment)
    await alertsService.saveAlertComment(TEST_ALERT_1.alertId!, comment2)

    const c = await caseService.getCase('C-1')

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

    await alertsService.deleteAlertComment(TEST_ALERT_1.alertId!, COMMENT_ID_1)

    const caseAfterDeletion = await caseService.getCase('C-1')

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

  test('Changing Status of a Case to Closed with Comments and Closes User Case', async () => {
    const caseService = await getCaseService(TEST_TENANT_ID)
    const alertsService = await getAlertsService(TEST_TENANT_ID)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
    })

    await alertsService.updateAlertsStatus(['A-1'], {
      alertStatus: 'CLOSED',
      priority: 'P1',
      comment: 'some comment',
      otherReason: 'some other reason',
      reason: ['False positive'],
    })

    const c = await caseService.getCase('C-1')

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
              body: 'Alert status changed to Closed. Reasons: False positive\nsome comment',
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
        reason: ['Other'],
        caseStatus: 'CLOSED',
        otherReason: 'All alerts of this case are Closed',
      },
      statusChanges: [
        {
          userId: FLAGRIGHT_SYSTEM_USER,
          timestamp: expect.any(Number),
          reason: ['Other'],
          caseStatus: 'CLOSED',
          otherReason: 'All alerts of this case are Closed',
        },
      ],
      comments: [
        {
          userId: 'Flagright System',
          body:
            'Case status changed to Closed. Reason: All alerts of this case are Closed\n' +
            'some comment',
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
    })

    await alertsService.updateAlertsStatus(['A-1'], {
      alertStatus: 'CLOSED',
      priority: 'P1',
      comment: 'some comment',
      otherReason: 'some other reason',
      reason: ['False positive'],
    })

    const c = await caseService.getCase('C-1')

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
              body: 'Alert status changed to Closed. Reasons: False positive\nsome comment',
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
    })

    const USER_ID_1 = nanoid()
    const USER_ID_2 = nanoid()

    await alertsService.updateAlertsAssignments(
      ['A-1'],
      [
        {
          assigneeUserId: USER_ID_1,
          timestamp: Date.now(),
          assignedByUserId: USER_ID_2,
        },
      ]
    )

    const c = await caseService.getCase('C-1')

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
    })

    await caseService.updateCasesStatus(['C-1-2'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      comment: 'some comment',
    })

    const c = await caseService.getCase('C-1-2')

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

  test('Closing a case closes all it alerts', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-1',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
    })

    await caseService.updateCasesStatus(['C-1-1'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      comment: 'some comment',
    })

    const c = await caseService.getCase('C-1-1')

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
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
        {
          alertId: 'A-3',
          alertStatus: 'CLOSED',
          caseId: 'C-1-1',
          lastStatusChange: {
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
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
    })

    await caseService.updateCasesAssignments(
      ['C-1-2'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c = await caseService.getCase('C-1-2')

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
    })

    await caseService.updateCasesReviewAssignments(
      ['C-1-3'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c = await caseService.getCase('C-1-3')

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
    })

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
    })

    await caseService.updateCasesAssignments(
      ['C-1-4', 'C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c1 = await caseService.getCase('C-1-4')

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

    const c2 = await caseService.getCase('C-1-5')

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
    })

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
    })

    await caseService.updateCasesReviewAssignments(
      ['C-1-4', 'C-1-5'],
      [
        {
          assigneeUserId: 'ACCOUNT-1',
          timestamp: Date.now(),
          assignedByUserId: 'ACCOUNT-2',
        },
      ]
    )

    const c1 = await caseService.getCase('C-1-4')

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

    const c2 = await caseService.getCase('C-1-5')

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

  test('Close an Case and repoepn it but alerts should not reopen', async () => {
    const caseService = await getCaseService(tenantId)

    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-6',
      createdTimestamp: Date.now(),
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_3],
      assignments: undefined,
      reviewAssignments: undefined,
    })

    await caseService.updateCasesStatus(['C-1-6'], {
      caseStatus: 'CLOSED',
      comment: 'I am closing this case',
      reason: ['False positive', 'Other'],
      otherReason: 'This is a duplicate case',
    })

    const c1 = await caseService.getCase('C-1-6')

    expect(c1).toMatchObject({
      caseId: 'C-1-6',
      caseStatus: 'CLOSED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
        {
          alertId: 'A-3',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
      ],
      assignments: null,
      reviewAssignments: null,
      lastStatusChange: {
        userId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        reason: ['False positive', 'Other'],
        caseStatus: 'CLOSED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          reason: ['False positive', 'Other'],
          caseStatus: 'CLOSED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-1',
          body: 'Case status changed to Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
        },
      ],
    })

    await caseService.updateCasesStatus(['C-1-6'], {
      caseStatus: 'REOPENED',
      reason: ['Other'],
      otherReason: 'This is a duplicate case',
    })

    const c2 = await caseService.getCase('C-1-6')

    expect(c2).toMatchObject({
      caseId: 'C-1-6',
      createdTimestamp: expect.any(Number),
      caseStatus: 'REOPENED',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
        {
          alertId: 'A-3',
          alertStatus: 'CLOSED',
          caseId: 'C-1-6',
          lastStatusChange: {
            userId: 'ACCOUNT-1',
            timestamp: expect.any(Number),
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-1',
              timestamp: expect.any(Number),
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
      ],
      lastStatusChange: {
        userId: 'ACCOUNT-1',
        timestamp: expect.any(Number),
        reason: ['Other'],
        caseStatus: 'REOPENED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          reason: ['False positive', 'Other'],
          caseStatus: 'CLOSED',
          otherReason: 'This is a duplicate case',
        },
        {
          userId: 'ACCOUNT-1',
          timestamp: expect.any(Number),
          reason: ['Other'],
          caseStatus: 'REOPENED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-1',
          body: 'Case status changed to Closed. Reasons: False positive, This is a duplicate case\nI am closing this case',
          files: [],
          id: expect.any(String),
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
        {
          userId: 'ACCOUNT-1',
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
    })

    // Add assignments to the case
    await caseService.updateCasesAssignments(
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
    const c = await caseService.getCase('C-1-5')

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
    })

    // Add assignments to the case
    await caseService.updateCasesReviewAssignments(
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
    const c = await caseService.getCase('C-1-5')

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
      user: { id: TEST_ACCOUNT_3.id, role: 'admin' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
    })
    await caseService.updateCasesStatus(['C-1-5'], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })
    const c = await caseService.getCase('C-1-5')
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
              userId: 'Flagright System',
              body: 'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\nI am closing this case',
              files: [],
            },
          ],
          lastStatusChange: {
            userId: 'ACCOUNT-3',
            reason: ['Other'],
            caseStatus: 'IN_REVIEW_CLOSED',
            otherReason:
              'Case of this alert was In Review Requested to be Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-3',
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
        userId: 'ACCOUNT-3',
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Closed. Reason: False positive\nI am closing this case',
          files: [],
          userId: 'ACCOUNT-3',
        },
      ],
    })
  })

  it('Should Send a Case To In Review when Escalated', async () => {
    const caseService = await getCaseService(tenantId)
    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'admin' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId: 'C-1-5',
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
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

    const c = await caseService.getCase('C-1-5')
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
              userId: 'Flagright System',
              body: 'Alert status changed to In Review and is requested to be Escalated. Reasons: Case of this alert was In Review Requested to be Escalated\nI am closing this case',
              files: [],
            },
          ],
          lastStatusChange: {
            userId: 'ACCOUNT-3',
            reason: ['Other'],
            caseStatus: 'IN_REVIEW_ESCALATED',
            otherReason:
              'Case of this alert was In Review Requested to be Escalated',
          },
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          statusChanges: [
            {
              userId: 'ACCOUNT-3',
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
        userId: 'ACCOUNT-3',
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_ESCALATED',
        otherReason: 'This is a duplicate case',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_ESCALATED',
          otherReason: 'This is a duplicate case',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Escalated. Reason: False positive\nI am closing this case',
          files: [],
          userId: 'ACCOUNT-3',
        },
      ],
    })
  })

  test('Reviewer chooses to Approve whole Open case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-5'
    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
    })

    await caseService.updateCasesStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })

    const c = await caseService.getCase(caseId)
    expect(c?.caseStatus).toBe('IN_REVIEW_CLOSED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_CLOSED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    expect(c?.alerts?.[0]).toMatchObject({
      lastStatusChange: {
        userId: 'ACCOUNT-3',
        reason: ['Other'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'Case of this alert was In Review Requested to be Closed',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['Other'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason:
            'Case of this alert was In Review Requested to be Closed',
        },
      ],
      comments: [
        {
          userId: 'Flagright System',
          body:
            'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\n' +
            'I am closing this case',
        },
      ],
    })
    await caseService.updateCasesStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: [],
    })
    const c2 = await caseService.getCase(caseId)
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
              userId: 'Flagright System',
              body: 'Alert status changed to In Review and is requested to be Closed. Reasons: Case of this alert was In Review Requested to be Closed\nI am closing this case',
            },
            {
              userId: 'Flagright System',
              body: 'Alert is Approved and its status is changed to Closed. Reasons: Case of this alert was Closed',
            },
          ],
          lastStatusChange: {
            userId: 'ACCOUNT-3',
            reason: ['Other'],
            caseStatus: 'CLOSED',
            otherReason: 'Case of this alert was Closed',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_CLOSED',
              otherReason:
                'Case of this alert was In Review Requested to be Closed',
            },
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'CLOSED',
              otherReason: 'Case of this alert was Closed',
            },
          ],
        },
        { alertId: 'A-2', alertStatus: 'CLOSED', caseId: 'C-1-5' },
      ],
      lastStatusChange: {
        userId: 'ACCOUNT-3',
        reason: [],
        caseStatus: 'CLOSED',
      },
      statusChanges: [
        {
          userId: 'ACCOUNT-3',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate case',
        },
        {
          userId: 'ACCOUNT-3',
          reason: [],
          caseStatus: 'CLOSED',
        },
      ],
      comments: [
        {
          body: 'Case status changed to In Review and is requested to be Closed. Reason: False positive\nI am closing this case',
          userId: 'ACCOUNT-3',
        },
        {
          body: 'Case is Approved and its status is changed to Closed.',
          userId: 'ACCOUNT-3',
        },
      ],
    })
  })

  test('Reviewer chooses to Send Back the whole case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-6'
    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
    })
    await caseService.updateCasesStatus([caseId], {
      caseStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate case',
      comment: 'I am closing this case',
    })
    await caseService.updateCasesStatus([caseId], {
      caseStatus: 'OPEN',
      reason: [],
    })
    const c = await caseService.getCase(caseId)
    expect(c?.caseStatus).toBe('OPEN')
  })

  test('Reviewer chooses to Approve the whole Escalated case', async () => {
    const caseService = await getCaseService(tenantId)
    const caseId = 'C-1-6'
    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
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
    const c = await caseService.getCase(caseId)
    expect(c?.caseStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    await caseService.escalateCase(caseId, {
      reason: [],
    })

    const c2 = await caseService.getCase(caseId)
    expect(c2).toMatchObject({
      caseId: 'C-1-6',
      caseStatus: 'ESCALATED',
      alerts: [
        {
          alertId: alertId1,
          alertStatus: 'ESCALATED',
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          lastStatusChange: {
            userId: 'ACCOUNT-3',
            reason: ['Other'],
            caseStatus: 'ESCALATED',
            otherReason: 'Case of this alert was Escalated',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_ESCALATED',
              otherReason:
                'Case of this alert was In Review Requested to be Escalated',
            },
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'ESCALATED',
              otherReason: 'Case of this alert was Escalated',
            },
          ],
          comments: [
            {
              userId: 'Flagright System',
              body: 'Alert status changed to In Review and is requested to be Escalated. Reasons: Case of this alert was In Review Requested to be Escalated\nI am closing this case',
            },
            {
              userId: 'Flagright System',
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
          body: 'Case status changed to In Review and is requested to be Escalated. Reason: False positive\nI am closing this case',
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
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
    })
    await caseService.caseRepository.addCaseMongo({
      caseId,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT_1, TEST_ALERT_2],
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
    const c = await caseService.getCase(caseId)
    expect(c?.caseStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    expect(c?.alerts?.[1]?.alertStatus).toBe('CLOSED')
    await caseService.updateCasesStatus([caseId], {
      caseStatus: 'OPEN',
      reason: [],
    })
    const c2 = await caseService.getCase(caseId)
    expect(c2).toMatchObject({
      caseId: 'C-1-7',
      caseStatus: 'OPEN',
      alerts: [
        {
          alertId: 'A-1',
          alertStatus: 'OPEN',
          reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
          lastStatusChange: {
            userId: 'ACCOUNT-3',
            reason: ['Other'],
            caseStatus: 'OPEN',
            otherReason: 'Case of this alert was Open',
          },
          statusChanges: [
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'IN_REVIEW_ESCALATED',
              otherReason:
                'Case of this alert was In Review Requested to be Escalated',
            },
            {
              userId: 'ACCOUNT-3',
              reason: ['Other'],
              caseStatus: 'OPEN',
              otherReason: 'Case of this alert was Open',
            },
          ],
        },
        { alertId: 'A-2', alertStatus: 'CLOSED' },
      ],
      assignments: [{ assigneeUserId: 'ACCOUNT-3' }],
      reviewAssignments: [{ assigneeUserId: 'ACCOUNT-1' }],
    })
  })

  test('Alert stauts is changed to IN_REVIEW when reviewer chooses to close the alert', async () => {
    const caseService = await getCaseService(tenantId)
    const alertsService = await getAlertsService(tenantId)
    const caseId = 'C-1-8'
    const testAlertId = nanoid()
    const testAlertId2 = nanoid()
    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
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
    })
    await alertsService.updateAlertsStatus([testAlertId], {
      alertStatus: 'CLOSED',
      reason: ['False positive'],
      otherReason: 'This is a duplicate alert',
      comment: 'I am closing this alert',
    })
    const a = await alertsService.getAlert(testAlertId)
    expect(a?.alertStatus).toBe('IN_REVIEW_CLOSED')
    const a2 = await alertsService.getAlert(testAlertId2)
    expect(a2?.alertStatus).toBe('CLOSED')
    expect(a).toMatchObject({
      alertStatus: 'IN_REVIEW_CLOSED',
      caseId: 'C-1-8',
      lastStatusChange: {
        userId: 'Flagright System',
        reason: ['False positive'],
        caseStatus: 'IN_REVIEW_CLOSED',
        otherReason: 'This is a duplicate alert',
      },
      statusChanges: [
        {
          userId: 'Flagright System',
          reason: ['False positive'],
          caseStatus: 'IN_REVIEW_CLOSED',
          otherReason: 'This is a duplicate alert',
        },
      ],
      comments: [
        {
          userId: 'ACCOUNT-3',
          body:
            'Alert status changed to In Review and is requested to be Closed. Reasons: False positive\n' +
            'I am closing this alert',
        },
      ],
    })
  })

  test('Alerts Partial Escaltaion', async () => {
    const caseService = await getCaseService(tenantId)
    const alertsService = await getAlertsService(tenantId)

    const caseId = nanoid()
    const caseId2 = nanoid()
    const testAlertIds = [nanoid(), nanoid(), nanoid(), nanoid()]
    const closedTestAlertId = nanoid()

    getContextMocker.mockReturnValue({
      user: { id: TEST_ACCOUNT_3.id, role: 'REVIEWER' },
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
    const c = await caseService.getCase(caseId)
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

    const c2 = await caseService.getCase(caseId2)

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
    })
    const c3 = await caseService.getCase(caseId2)
    expect(c3?.caseStatus).toBe('IN_REVIEW_CLOSED')
    expect(c3?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    Array.from({ length: 2 }).forEach((_, i) => {
      expect(c3?.alerts?.[i + 1]?.alertStatus).toBe('IN_REVIEW_CLOSED')
    })
    expect(c3?.alerts?.[3]?.alertStatus).toBe('CLOSED')
    const c4 = await caseService.getCase(`${caseId2}.1`)
    expect(c4?.caseStatus).toBe('ESCALATED')
    expect(c4?.alerts?.[0]?.alertStatus).toBe('ESCALATED')
    await alertsService.updateAlertsStatus([testAlertIds[1]], {
      alertStatus: 'OPEN',
      reason: [],
    })
    const c5 = await caseService.getCase(caseId)
    expect(c5?.caseStatus).toBe('OPEN')
    expect(c5?.alerts?.[1]?.alertStatus).toBe('OPEN')
    expect(c5?.alerts?.[0]?.alertStatus).toBe('IN_REVIEW_ESCALATED')
    await caseService.updateCasesStatus([caseId2], {
      reason: [],
      caseStatus: 'CLOSED',
    })
    const c6 = await caseService.getCase(caseId2)
    expect(c6?.caseStatus).toBe('CLOSED')
    Array.from({ length: 3 }).forEach((_, i) => {
      expect(c6?.alerts?.[i]?.alertStatus).toBe('CLOSED')
    })
  })
})
