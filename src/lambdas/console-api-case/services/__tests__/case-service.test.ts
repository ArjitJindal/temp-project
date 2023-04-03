import { NotFound } from 'http-errors'
import dayjs from 'dayjs'
import { CaseService } from '../case-service'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { getS3ClientByEvent } from '@/utils/s3'
import { Account } from '@/services/accounts'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Alert } from '@/@types/openapi-internal/Alert'

const TEST_ACCOUNT_1: Account = {
  id: 'ACCOUNT-1',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'ACCOUNT-1',
  blocked: false,
}
const TEST_ALERT_1: Alert = {
  alertId: 'A-1',
  alertStatus: 'OPEN',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleInstanceId: '',
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
  ruleInstanceId: '',
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
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  const caseService = new CaseService(
    caseRepository,
    dashboardStatsRepository,
    s3,
    'tmp',
    'document'
  )
  return caseService
}

describe('Case service', () => {
  describe('Escalation: single case', () => {
    const TEST_TENANT_ID = getTestTenantId()

    test('throw NotFound error if case ID cannot be found', async () => {
      const caseServiceService = await getCaseService(TEST_TENANT_ID)
      await expect(
        caseServiceService.escalateCase('ghost', {}, [])
      ).rejects.toThrow(NotFound)
    })

    test('update case status, update alert statuses, and assign review assignments', async () => {
      const caseServiceService = await getCaseService(TEST_TENANT_ID)
      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      await caseServiceService.caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
      })

      await caseServiceService.escalateCase(
        'C-1',
        { comment: 'test comment' },
        [TEST_ACCOUNT_1]
      )

      const c = await caseServiceService.getCase('C-1')
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
      const caseServiceService = await getCaseService(TEST_TENANT_ID)
      const t = dayjs('2023-01-01T00:00:00.000Z').valueOf()
      await caseServiceService.caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: t,
        caseStatus: 'OPEN',
        assignments: [{ assigneeUserId: 'U-1', timestamp: t }],
        reviewAssignments: [{ assigneeUserId: 'U-2', timestamp: t }],
        alerts: [TEST_ALERT_1, TEST_ALERT_2],
      })
      await caseServiceService.escalateCase('C-2', {}, [TEST_ACCOUNT_1])
      const c = await caseServiceService.getCase('C-2')
      expect(c).toMatchObject({
        caseId: 'C-2',
        reviewAssignments: [{ assigneeUserId: 'U-2', timestamp: t }],
      })
    })
  })
})
