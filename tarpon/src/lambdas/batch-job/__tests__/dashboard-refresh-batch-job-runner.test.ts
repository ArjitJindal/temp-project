import { jobRunnerHandler } from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantIdAndCreateCollections } from '@/test-utils/tenant-test-utils'
import { DashboardRefreshBatchJob } from '@/@types/batch-job'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

dynamoDbSetupHook()

const refreshCaseStatsMock = jest.spyOn(
  DashboardStatsRepository.prototype,
  'refreshCaseStats'
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
    const tenantId = await getTestTenantIdAndCreateCollections()
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
      }),
      // C-2 and C-3 should be merged into one time range
      caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: latest.subtract(1, 'day').valueOf(),
        updatedAt: latest.valueOf(),
        caseType: 'SYSTEM',
      }),
      caseRepository.addCaseMongo({
        caseId: 'C-3',
        createdTimestamp: latest
          .subtract(1, 'day')
          .subtract(1, 'hour')
          .valueOf(),
        updatedAt: latest.valueOf(),
        caseType: 'SYSTEM',
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

    expect(refreshCaseStatsMock).toBeCalledTimes(2)
    expect(refreshCaseStatsMock).toHaveBeenNthCalledWith(1, {
      startTimestamp: 1695164400000,
      endTimestamp: 1695171600000,
    })
    expect(refreshCaseStatsMock).toHaveBeenNthCalledWith(2, {
      startTimestamp: 1695254400000,
      endTimestamp: 1695258000000,
    })

    expect(refreshTeamStatsMock).toBeCalledTimes(1)
    expect(refreshTeamStatsMock).toBeCalledWith(checkTimeRange)

    expect(refreshUserStatsMock).toBeCalledTimes(1)
  })
})
