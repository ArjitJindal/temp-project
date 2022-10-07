import {
  getStatsRepo,
  getTransactionsRepo,
  hitRule,
  notHitRule,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
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
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp,
      }),
      hitRules: hitRules,
      executedRules: hitRules,
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    })
    await statsRepository.refreshStats(timestamp)
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(originUserId)
      expect(item.transactionsHit).toEqual(1)
      expect(item.rulesHit).toEqual(hitRules.length)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(destinationUserId)
      expect(item.transactionsHit).toEqual(1)
      expect(item.rulesHit).toEqual(hitRules.length)
    }
  })
  test('Single transaction with uneven executed and hit rules', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule('BLOCK'), hitRule('FLAG'), hitRule('BLOCK')]

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp,
      }),
      hitRules: hitRules,
      executedRules: [...hitRules, notHitRule('BLOCK'), notHitRule('FLAG')],
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    })
    await statsRepository.refreshStats(timestamp)
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(originUserId)
      expect(item.rulesHit).toEqual(hitRules.length)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(destinationUserId)
      expect(item.rulesHit).toEqual(hitRules.length)
    }
  })
  test('Multiple transaction with hits should sum up', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRulesCount = 3
    const transactionsCount = 10

    for (let i = 0; i < transactionsCount; i += 1) {
      const hitRules = [...new Array(hitRulesCount)].map(() => hitRule())
      const timestamp = initialTimestamp + 3600 * 1000 * i
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      })
      await statsRepository.refreshStats(timestamp)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(originUserId)
      expect(item.rulesHit).toEqual(hitRulesCount * transactionsCount)
      expect(item.transactionsHit).toEqual(transactionsCount)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(destinationUserId)
      expect(item.rulesHit).toEqual(hitRulesCount * transactionsCount)
      expect(item.transactionsHit).toEqual(transactionsCount)
    }
  })
  test('Large amount of transactions', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const transactionsCount = 100

    const hitRules = [hitRule()]

    for (let i = 0; i < transactionsCount; i += 1) {
      const timestamp = initialTimestamp + 3600 * 1000 * i
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: hitRules,
        executedRules: [...hitRules, notHitRule()],
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      })
      await statsRepository.refreshStats(timestamp)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(originUserId)
      expect(item.transactionsHit).toEqual(transactionsCount)
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION'
      )
      expect(stats).toHaveLength(1)
      const [item] = stats
      expect(item.userId).toEqual(destinationUserId)
      expect(item.transactionsHit).toEqual(transactionsCount)
    }
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
