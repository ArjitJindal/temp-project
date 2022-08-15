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

const TENANT_ID = getTestTenantId()

describe('Verify transactions counting statistics', () => {
  test('Single transaction with no hits should only count 1 total transaction', async () => {
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
  })
  test('Single hit rule for each rule actions', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('BLOCK')],
      executedRules: [hitRule('BLOCK')],
    })
    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('SUSPEND')],
      executedRules: [hitRule('SUSPEND')],
    })
    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('FLAG')],
      executedRules: [hitRule('FLAG')],
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
  })
  test('Hit result should be the most strict action', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const hitRules = [
      hitRule('SUSPEND'),
      hitRule('FLAG'),
      hitRule('BLOCK'),
      hitRule('ALLOW'),
    ]

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: hitRules,
      executedRules: hitRules,
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
  })
  test('Executed rules should not be counted', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addCaseToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [],
      executedRules: [notHitRule(), notHitRule(), notHitRule()],
    })
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
  })
  test('One transaction every hour with no hits', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T01:00:00.000Z')
    const timestamp = d.valueOf()

    for (let i = 0; i < 10; i += 1) {
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp: timestamp + i * 3600 * 1000,
        }),
        hitRules: [],
        executedRules: [],
      })
    }
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
  })
  test('One transaction every hour with hit', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T01:00:00.000Z')
    const timestamp = d.valueOf()

    for (let i = 0; i < 10; i += 1) {
      await transactionRepository.addCaseToMongo({
        ...getTestTransaction({
          timestamp: timestamp + i * 3600 * 1000,
        }),
        hitRules: [hitRule('SUSPEND')],
        executedRules: [],
      })
    }
    await statsRepository.refreshStats()
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf()
    )
    expect(stats).toHaveLength(25)
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
