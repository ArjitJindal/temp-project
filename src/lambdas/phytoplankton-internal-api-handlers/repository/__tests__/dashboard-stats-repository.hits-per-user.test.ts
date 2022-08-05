import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  getStatsRepo,
  getTransactionsRepo,
  hitRule,
  notHitRule,
} from '@/lambdas/phytoplankton-internal-api-handlers/repository/__tests__/helpers'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoClient } from '@/test-utils/mongo-test-utils'
import { logger } from '@/core/logger'

dynamoDbSetupHook()

describe('Verify hits-per-user statistics', () => {
  test('Single transaction with single hit', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const hitRules = [hitRule()]

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: hitRules,
      executedRules: hitRules,
      originUserId: originUserId,
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getHitsByUserStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(1)
    const [item] = stats
    expect(item.originUserId).toEqual(originUserId)
    expect(item.rulesHit).toEqual(hitRules.length)
  })
  test('Single transaction with uneven executed and hit rules', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const hitRules = [hitRule('BLOCK'), hitRule('FLAG'), hitRule('BLOCK')]

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: hitRules,
      executedRules: [...hitRules, notHitRule('BLOCK'), notHitRule('FLAG')],
      originUserId: originUserId,
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getHitsByUserStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(1)
    const [item] = stats
    expect(item.originUserId).toEqual(originUserId)
    expect(item.rulesHit).toEqual(hitRules.length)
  })
  test('Multiple transaction with hits should sum up', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const hitRulesCount = 3
    const transactionsCount = 10

    for (let i = 0; i < transactionsCount; i += 1) {
      const hitRules = [...new Array(hitRulesCount)].map(() => hitRule())
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp: timestamp + 3600 * 1000 * i,
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
      })
    }
    await statsRepository.refreshStats()
    const stats = await statsRepository.getHitsByUserStats(
      0,
      Number.MAX_SAFE_INTEGER
    )
    expect(stats).toHaveLength(1)
    const [item] = stats
    expect(item.originUserId).toEqual(originUserId)
    expect(item.rulesHit).toEqual(hitRulesCount * transactionsCount)
  })
  test('Large amount of transactions', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const transactionsCount = 1000

    const hitRules = [hitRule()]

    for (let i = 0; i < transactionsCount; i += 1) {
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp: timestamp + 3600 * 1000 * i,
        }),
        hitRules: hitRules,
        executedRules: [...hitRules, notHitRule()],
        originUserId: originUserId,
      })
    }
    await statsRepository.refreshStats()
    const stats = await statsRepository.getHitsByUserStats(
      0,
      Number.MAX_SAFE_INTEGER
    )
    expect(stats).toHaveLength(1)
    const [item] = stats
    expect(item.originUserId).toEqual(originUserId)
    expect(item.rulesHit).toEqual(transactionsCount)
  })
})

afterAll(async () => {
  const mongoDb = await getMongoClient()
  const db = mongoDb.db()

  try {
    await db.dropDatabase()
  } catch (e) {
    logger.error(`Mongo: unable to drop test db`, e)
  }
})
