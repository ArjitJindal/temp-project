import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { DashboardRefreshBatchJob } from '@/@types/batch-job'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { CaseRepository } from '@/services/cases/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import { Alert } from '@/@types/openapi-internal/Alert'

dynamoDbSetupHook()

const TEST_ALERT: Alert = {
  alertId: 'A-1',
  createdTimestamp: 0,
  transactionIds: ['T-1'],
  ruleName: 'R-1',
  ruleInstanceId: '1',
  ruleAction: 'BLOCK',
  updatedAt: 0,
  priority: 'P1',
  ruleDescription: 'Test rule which always hit',
  numberOfTransactionsHit: 1,
  ruleId: 'R-1',
}

const refreshAlertsStatsMock = jest.spyOn(
  DashboardStatsRepository.prototype,
  'refreshAlertsStats'
)
const refreshTeamStatsMock = jest.spyOn(
  DashboardStatsRepository.prototype,
  'refreshTeamStats'
)
const refreshTransactionStatsMock = jest.spyOn(
  DashboardStatsRepository.prototype,
  'refreshTransactionStats'
)
const refreshUserStatsMock = jest.spyOn(
  DashboardStatsRepository.prototype,
  'refreshUserStats'
)

describe('Dashboard refresh runner', () => {
  test('refreshs all the dashboard stats', async () => {
    const tenantId = await getTestTenantId()
    const caseUsers = {
      origin: {
        userId: 'U-1',
        updatedAt: 0,
        type: 'CONSUMER',
      },
      destination: {
        userId: 'U-2',
        updatedAt: 0,
        type: 'CONSUMER',
      },
    }
    // Prepare testing data
    const latest = dayjs('2023-09-21')
    const mongoDb = await getMongoDbClient()
    const caseRepository = new CaseRepository(tenantId, { mongoDb })
    await Promise.all([
      caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: latest.valueOf(),
        updatedAt: latest.valueOf(),
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        caseUsers,
        alerts: [
          {
            ...TEST_ALERT,
            createdTimestamp: latest.valueOf(),
            updatedAt: latest.valueOf(),
            alertId: 'A-1',
          },
        ],
      }),
      // C-2 and C-3 should be merged into one time range
      caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: latest.subtract(1, 'day').valueOf(),
        updatedAt: latest.subtract(1, 'day').valueOf(),
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        caseUsers,
        alerts: [
          {
            ...TEST_ALERT,
            createdTimestamp: latest.subtract(1, 'day').valueOf(),
            updatedAt: latest.subtract(1, 'day').valueOf(),
            alertId: 'A-2',
          },
        ],
      }),
      caseRepository.addCaseMongo({
        caseId: 'C-3',
        createdTimestamp: latest
          .subtract(1, 'day')
          .subtract(1, 'hour')
          .valueOf(),
        updatedAt: latest.subtract(1, 'day').subtract(1, 'hour').valueOf(),
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        caseUsers,
        alerts: [
          {
            ...TEST_ALERT,
            createdTimestamp: latest
              .subtract(1, 'day')
              .subtract(1, 'hour')
              .valueOf(),
            updatedAt: latest.subtract(1, 'day').subtract(1, 'hour').valueOf(),
            alertId: 'A-3',
          },
        ],
      }),
    ])
    const transactionsCollection = mongoDb
      .db()
      .collection(TRANSACTIONS_COLLECTION(tenantId))
    await Promise.all([
      transactionsCollection.insertOne({
        transactionId: 'T-1',
        timestamp: latest.valueOf(),
        updatedAt: latest.valueOf(),
      }),
      // T-2 and T-3 should be merged into one time range
      transactionsCollection.insertOne({
        transactionId: 'T-2',
        timestamp: latest.subtract(1, 'day').valueOf(),
        updatedAt: latest.valueOf(),
      }),
      transactionsCollection.insertOne({
        transactionId: 'T-3',
        timestamp: latest.subtract(1, 'day').subtract(1, 'hour').valueOf(),
        updatedAt: latest.valueOf(),
      }),
    ])
    const usersCollection = mongoDb.db().collection(USERS_COLLECTION(tenantId))
    await Promise.all([
      usersCollection.insertOne({
        userId: 'U-1',
        updatedAt: latest.valueOf(),
      }),
      usersCollection.insertOne({
        userId: 'U-2',
        updatedAt: latest.valueOf(),
      }),
    ])

    const checkTimeRange = {
      startTimestamp: latest.subtract(10, 'minute').valueOf(),
      endTimestamp: latest.add(10, 'minute').valueOf(),
    }
    const testJob: DashboardRefreshBatchJob = {
      type: 'DASHBOARD_REFRESH',
      tenantId,
      parameters: {
        checkTimeRange,
      },
    }
    await jobRunnerHandler(testJob)

    expect(refreshTransactionStatsMock).toBeCalledTimes(2)
    expect(refreshTransactionStatsMock).toHaveBeenNthCalledWith(1, {
      startTimestamp: 1695164400000,
      endTimestamp: 1695171600000,
    })
    expect(refreshTransactionStatsMock).toHaveBeenNthCalledWith(2, {
      startTimestamp: 1695254400000,
      endTimestamp: 1695258000000,
    })

    expect(refreshAlertsStatsMock).toBeCalledTimes(1)
    expect(refreshAlertsStatsMock).toHaveBeenNthCalledWith(1, {
      startTimestamp: 1695254400000,
      endTimestamp: 1695258000000,
    })

    expect(refreshTeamStatsMock).toBeCalledTimes(1)
    expect(refreshTeamStatsMock).toBeCalledWith(checkTimeRange)

    expect(refreshUserStatsMock).toBeCalledTimes(1)
  })
})
