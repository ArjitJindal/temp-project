import { OverviewStatsDashboardMetric } from '../../dashboard-metrics/overview-stats'
import { ShadowRuleStatsAnalytics } from '../../rules/shadow-rule-stats'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import { getTestUser } from '@/test-utils/user-test-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'

describe('Shadow rule stats test - Transaction', () => {
  const testTenantId = getTestTenantId()
  test('should get shadow rule stats', async () => {
    const mongoDb = await getMongoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      testTenantId,
      mongoDb
    )

    await Promise.all(
      Array.from({ length: 10 }).map(
        async (_, index) =>
          await transactionRepository.addTransactionToMongo({
            ...getTestTransaction({
              transactionId: `T-${index}`,
              originUserId: `U-${Math.max(0, index - 1)}`,
              destinationUserId: `U-${index}`,
            }),
            executedRules: [],
            timestamp: dayjs().valueOf(),
            hitRules: [
              {
                ruleInstanceId: `R-${index % 2}`,
                isShadow: true,
                ruleAction: 'ALLOW',
                ruleDescription: 'Allow all',
                ruleId: `R-${index % 5}`,
                ruleName: 'Allow all',
                labels: [],
                ruleHitMeta: {
                  hitDirections: ['DESTINATION', 'ORIGIN'],
                },
              },
            ],
            status: 'ALLOW',
          })
      )
    )

    jest
      .spyOn(OverviewStatsDashboardMetric, 'getAverageInvestigationTime')
      .mockResolvedValue(100)

    await ShadowRuleStatsAnalytics.refresh(testTenantId)

    const data = await ShadowRuleStatsAnalytics.get(
      testTenantId,
      'R-0',
      0,
      dayjs().valueOf()
    )

    expect(data).toEqual({
      transactionsHit: 5,
      usersHit: 9,
      alertsHit: 9,
      investigationTime: 900,
    })
  })

  test('When hitDirections is empty', async () => {
    const mongoDb = await getMongoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      testTenantId,
      mongoDb
    )

    await Promise.all(
      Array.from({ length: 10 }).map(
        async (_, index) =>
          await transactionRepository.addTransactionToMongo({
            ...getTestTransaction({
              transactionId: `T-${index}`,
              originUserId: `U-${Math.max(0, index - 1)}`,
              destinationUserId: `U-${index}`,
            }),
            executedRules: [],
            timestamp: dayjs().valueOf(),
            hitRules: [
              {
                ruleInstanceId: `R-${index % 2}`,
                isShadow: true,
                ruleAction: 'ALLOW',
                ruleDescription: 'Allow all',
                ruleId: `R-${index % 5}`,
                ruleName: 'Allow all',
                labels: [],
                ruleHitMeta: {
                  hitDirections: [],
                },
              },
            ],
            status: 'ALLOW',
          })
      )
    )

    jest
      .spyOn(OverviewStatsDashboardMetric, 'getAverageInvestigationTime')
      .mockResolvedValue(100)

    await ShadowRuleStatsAnalytics.refresh(testTenantId)

    const data = await ShadowRuleStatsAnalytics.get(
      testTenantId,
      'R-0',
      0,
      dayjs().valueOf()
    )

    expect(data).toEqual({
      transactionsHit: 5,
      usersHit: 0,
      alertsHit: 0,
      investigationTime: 0,
    })
  })
})

describe('Shadow rule stats test - User', () => {
  const testTenantId = getTestTenantId()
  test('should get shadow rule stats', async () => {
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(testTenantId, { mongoDb })

    await Promise.all(
      Array.from({ length: 10 }).map(
        async (_, index) =>
          await userRepository.saveUserMongo({
            ...getTestUser({
              userId: `U-${index}`,
            }),
            type: 'CONSUMER',
            executedRules: [],
            createdTimestamp: dayjs().valueOf(),
            hitRules: [
              {
                ruleInstanceId: `R-U-${index % 2}`,
                isShadow: true,
                ruleAction: 'ALLOW',
                ruleDescription: 'Allow all',
                ruleId: `R-U-${index % 5}`,
                ruleName: 'Allow all',
                labels: [],
                ruleHitMeta: {
                  hitDirections: ['ORIGIN'],
                },
              },
            ],
          })
      )
    )

    jest
      .spyOn(OverviewStatsDashboardMetric, 'getAverageInvestigationTime')
      .mockResolvedValue(100)

    await ShadowRuleStatsAnalytics.refresh(testTenantId)

    const data = await ShadowRuleStatsAnalytics.get(
      testTenantId,
      'R-U-0',
      0,
      dayjs().valueOf()
    )

    expect(data).toEqual({
      usersHit: 5,
      alertsHit: 5,
      investigationTime: 500,
      transactionsHit: 0,
    })
  })
})
