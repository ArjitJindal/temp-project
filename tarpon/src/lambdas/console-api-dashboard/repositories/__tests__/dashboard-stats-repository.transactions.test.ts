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
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

dynamoDbSetupHook()

describe('Verify transactions counting statistics', () => {
  test('Single transaction with no hits should only count 1 total transaction', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats(timestamp)
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
    ])
  })
  test('Single hit rule for each rule actions', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('BLOCK')],
      executedRules: [hitRule('BLOCK')],
    })
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('SUSPEND')],
      executedRules: [hitRule('SUSPEND')],
    })
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('FLAG')],
      executedRules: [hitRule('FLAG')],
    })
    await statsRepository.refreshTransactionStats(timestamp)
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30',
        flaggedTransactions: 1,
        stoppedTransactions: 1,
        suspendedTransactions: 1,
        totalTransactions: 3,
      },
    ])
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

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: hitRules,
      executedRules: hitRules,
    })
    await statsRepository.refreshTransactionStats(timestamp)
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30',
        flaggedTransactions: 0,
        stoppedTransactions: 1,
        suspendedTransactions: 0,
        totalTransactions: 1,
      },
    ])
  })
  test('Executed rules should not be counted', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [],
      executedRules: [notHitRule(), notHitRule(), notHitRule()],
    })
    await statsRepository.refreshTransactionStats(timestamp)
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30',
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
        totalTransactions: 1,
      },
    ])
  })
  test('One transaction every hour with no hits', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)
    const d = dayjs('2022-01-30T01:00:00.000Z')
    const initialTimestamp = d.valueOf()
    for (let i = 0; i < 3; i += 1) {
      const timestamp = initialTimestamp + i * 3600 * 1000
      await transactionRepository.addTransactionToMongo({
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: [],
        executedRules: [],
      })
      await statsRepository.refreshTransactionStats(timestamp)
    }
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T01:00:00.000Z').valueOf(),
      dayjs('2022-01-30T03:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30T01',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T02',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T03',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
    ])
  })
  test('One transaction every hour with hit', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T01:00:00.000Z')
    const initialTimestamp = d.valueOf()

    for (let i = 0; i < 3; i += 1) {
      const timestamp = initialTimestamp + i * 3600 * 1000
      await transactionRepository.addTransactionToMongo({
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: [hitRule('SUSPEND')],
        executedRules: [],
      })
      await statsRepository.refreshTransactionStats(timestamp)
    }
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T01:00:00.000Z').valueOf(),
      dayjs('2022-01-30T03:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(stats).toEqual([
      {
        _id: '2022-01-30T01',
        totalTransactions: 1,
        suspendedTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
      },
      {
        _id: '2022-01-30T02',
        totalTransactions: 1,
        suspendedTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
      },
      {
        _id: '2022-01-30T03',
        totalTransactions: 1,
        suspendedTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
      },
    ])
  })

  test('Hourly, Daily, Monthly granularity', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T01:00:00.000Z').valueOf()
    for (let i = 0; i < 3; i += 1) {
      const timestamp = initialTimestamp + i * 3600 * 1000
      await transactionRepository.addTransactionToMongo({
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: [hitRule('BLOCK')],
        executedRules: [hitRule('BLOCK')],
      })
      await statsRepository.refreshTransactionStats(timestamp)
    }

    const hourlyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T04:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(hourlyStats).toEqual([
      {
        _id: '2022-01-30T00',
        totalTransactions: 0,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T01',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 1,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T02',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 1,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T03',
        totalTransactions: 1,
        flaggedTransactions: 0,
        stoppedTransactions: 1,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30T04',
        totalTransactions: 0,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
    ])
    const dailyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-29T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(dailyStats).toEqual([
      {
        _id: '2022-01-29',
        totalTransactions: 0,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-30',
        totalTransactions: 3,
        flaggedTransactions: 0,
        stoppedTransactions: 3,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-01-31',
        totalTransactions: 0,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
    ])
    const monthlyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      dayjs('2022-02-01T00:00:00.000Z').valueOf(),
      'MONTH'
    )
    expect(monthlyStats).toEqual([
      {
        _id: '2022-01',
        totalTransactions: 3,
        flaggedTransactions: 0,
        stoppedTransactions: 3,
        suspendedTransactions: 0,
      },
      {
        _id: '2022-02',
        totalTransactions: 0,
        flaggedTransactions: 0,
        stoppedTransactions: 0,
        suspendedTransactions: 0,
      },
    ])
  })
})

afterAll(async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  try {
    await db.dropDatabase()
  } catch (e) {
    logger.error(`Mongo: unable to drop test db`, e)
  }
})
