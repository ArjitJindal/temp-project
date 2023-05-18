import { NotFound, BadRequest } from 'http-errors'
import dayjs from 'dayjs'
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
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { getS3ClientByEvent } from '@/utils/s3'

const TEST_ACCOUNT_1: Account = {
  id: 'ACCOUNT-1',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'ACCOUNT-1',
  blocked: false,
  isEscalationContact: true,
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

dynamoDbSetupHook()

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

describe('Case service', () => {
  describe('Escalation: single case', () => {
    const TEST_TENANT_ID = getTestTenantId()

    test('throw NotFound error if case ID cannot be found', async () => {
      const caseService = await getCaseService(TEST_TENANT_ID)
      await expect(caseService.escalateCase('ghost', {}, [])).rejects.toThrow(
        NotFound
      )
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

      await caseService.escalateCase('C-1', { comment: 'test comment' }, [
        TEST_ACCOUNT_1,
      ])

      const c = await caseService.getCase('C-1')
      expect(c).toMatchObject({
        caseId: 'C-1',
        createdTimestamp: t,
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: 1672531200000 }],
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
            body: 'Case status changed to ESCALATED. test comment',
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
      await caseService.escalateCase('C-2', {}, [TEST_ACCOUNT_1])
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
      await expect(caseService.escalateCase('ghost', {}, [])).rejects.toThrow(
        NotFound
      )
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
      await alertsService.escalateAlerts(
        'C-2',
        {
          alertEscalations: [{ alertId: TEST_ALERT_1.alertId! }],
        },
        [TEST_ACCOUNT_1]
      )

      const c = await caseService.getCase('C-2.1')
      expect(c).toMatchObject({
        caseId: 'C-2.1',
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: 1672531200000 }],
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
      })
    })
    test('escalateAlerts throws error if caseId is null', async () => {
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await expect(
        alertsService.escalateAlerts(null as unknown as string, {}, [])
      ).rejects.toThrow(NotFound)
    })

    test('escalateAlerts throws error if caseId is undefined', async () => {
      const alertsService = await getAlertsService(TEST_TENANT_ID)
      await expect(
        alertsService.escalateAlerts(undefined as unknown as string, {}, [])
      ).rejects.toThrow(NotFound)
    })

    test('should throw BadRequest error when trying to escalate an already escalated case', async () => {
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
        alertsService.escalateAlerts(childCaseId, caseEscalationRequest, [
          TEST_ACCOUNT_1,
        ])
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

      await alertsService.escalateAlerts(
        'C-2',
        {
          alertEscalations: [{ alertId: TEST_ALERT_1.alertId! }],
          caseUpdateRequest: { caseStatus: 'CLOSED', comment: 'New comment' },
        },
        [TEST_ACCOUNT_1]
      )

      const c = await caseService.getCase('C-2.1')
      expect(c).toMatchObject({
        caseId: 'C-2.1',
        caseStatus: 'ESCALATED',
        assignments: [{ assigneeUserId: 'U-1', timestamp: 1672531200000 }],
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
