import { getCaseRepo, getStatsRepo } from './helpers'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()

const TEST_ACCOUNT_ID_1 = 'TEST_ACCOUNT_ID_1'
const TEST_ACCOUNT_ID_2 = 'TEST_ACCOUNT_ID_2'

withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  describe('Latest Team Stats', () => {
    describe('Latest Team Stats for cases', () => {
      test('basic case assignments', async () => {
        const TENANT_ID = getTestTenantId()
        const caseRepository = await getCaseRepo(TENANT_ID)
        const statsRepository = await getStatsRepo(TENANT_ID)

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          caseStatus: 'OPEN',
          assignments: [
            assignment(TEST_ACCOUNT_ID_1),
            assignment(TEST_ACCOUNT_ID_2),
          ],
        })

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          caseStatus: 'OPEN_IN_PROGRESS',
          assignments: [assignment(TEST_ACCOUNT_ID_1)],
        })

        await expectLatestTeamStats(statsRepository, 'CASES', [
          {
            accountId: TEST_ACCOUNT_ID_1,
            open: 1,
            inProgress: 1,
            inReview: 0,
            escalated: 0,
            onHold: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            open: 1,
            inProgress: 0,
            inReview: 0,
            escalated: 0,
            onHold: 0,
          },
        ])
      })

      test('case review assignments', async () => {
        const TENANT_ID = getTestTenantId()
        const caseRepository = await getCaseRepo(TENANT_ID)
        const statsRepository = await getStatsRepo(TENANT_ID)

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          caseStatus: 'ESCALATED',
          reviewAssignments: [
            assignment(TEST_ACCOUNT_ID_1),
            assignment(TEST_ACCOUNT_ID_2),
          ],
        })

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          caseStatus: 'ESCALATED_IN_PROGRESS',
          reviewAssignments: [assignment(TEST_ACCOUNT_ID_1)],
        })

        await expectLatestTeamStats(statsRepository, 'CASES', [
          {
            accountId: TEST_ACCOUNT_ID_1,
            open: 0,
            inProgress: 1,
            inReview: 0,
            escalated: 1,
            onHold: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            open: 0,
            inProgress: 0,
            inReview: 0,
            escalated: 1,
            onHold: 0,
          },
        ])
      })
    })

    describe('Latest Team Stats for alerts', () => {
      test('basic alert assignments', async () => {
        const TENANT_ID = getTestTenantId()
        const caseRepository = await getCaseRepo(TENANT_ID)
        const statsRepository = await getStatsRepo(TENANT_ID)

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          alerts: [
            {
              ...emptyAlert(),
              alertStatus: 'OPEN',
              assignments: [
                assignment(TEST_ACCOUNT_ID_1),
                assignment(TEST_ACCOUNT_ID_2),
              ],
            },
          ],
        })

        await expectLatestTeamStats(statsRepository, 'ALERTS', [
          {
            accountId: TEST_ACCOUNT_ID_1,
            open: 1,
            inProgress: 0,
            inReview: 0,
            escalated: 0,
            onHold: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            open: 1,
            inProgress: 0,
            inReview: 0,
            escalated: 0,
            onHold: 0,
          },
        ])
      })

      test('alert review assignments', async () => {
        const TENANT_ID = getTestTenantId()
        const caseRepository = await getCaseRepo(TENANT_ID)
        const statsRepository = await getStatsRepo(TENANT_ID)

        await caseRepository.addCaseMongo({
          ...emptyCase(),
          alerts: [
            {
              ...emptyAlert(),
              alertStatus: 'ESCALATED',
              reviewAssignments: [
                assignment(TEST_ACCOUNT_ID_1),
                assignment(TEST_ACCOUNT_ID_2),
              ],
            },
            {
              ...emptyAlert(),
              alertStatus: 'ESCALATED_IN_PROGRESS',
              reviewAssignments: [assignment(TEST_ACCOUNT_ID_1)],
            },
          ],
        })

        await expectLatestTeamStats(statsRepository, 'ALERTS', [
          {
            accountId: TEST_ACCOUNT_ID_1,
            open: 0,
            inProgress: 1,
            inReview: 0,
            escalated: 1,
            onHold: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            open: 0,
            inProgress: 0,
            inReview: 0,
            escalated: 1,
            onHold: 0,
          },
        ])
      })
    })
  })
})

async function expectLatestTeamStats(
  repo: DashboardStatsRepository,
  scope: 'CASES' | 'ALERTS',
  toExpect: {
    accountId: string
    open: number
    inProgress: number
    inReview: number
    escalated: number
    onHold: number
  }[],
  filters?: {
    accountIds?: string[]
    page?: number
    pageSize?: number
  }
) {
  await repo.refreshLatestTeamStats()
  const stats = await repo.getLatestTeamStatistics(
    scope,
    filters?.accountIds,
    filters?.pageSize,
    filters?.page
  )
  const { items, total } = stats
  expect(total).toBe(toExpect.length)
  expect(items).toHaveLength(toExpect.length)
  expect(items).toEqual(expect.arrayContaining(toExpect))
}

let counter = 0
function emptyCase(): Case {
  return {
    caseType: 'SYSTEM',
    caseId: `C-${counter++}`,
    caseStatus: 'OPEN',
    createdTimestamp: Date.now(),
    caseTransactionsIds: [],
    statusChanges: [],
    assignments: [],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
  }
}

function emptyAlert(): Alert {
  return {
    alertId: `C-${counter++}`,
    alertStatus: 'OPEN',
    createdTimestamp: Date.now(),
    ruleInstanceId: '',
    ruleId: '',
    ruleName: '',
    ruleDescription: '',
    ruleAction: 'BLOCK',
    numberOfTransactionsHit: 0,
    priority: 'P1',
  }
}

function assignment(userId: string, timestamp?: number): Assignment {
  return {
    assigneeUserId: userId,
    timestamp: timestamp ?? Date.now(),
  }
}
