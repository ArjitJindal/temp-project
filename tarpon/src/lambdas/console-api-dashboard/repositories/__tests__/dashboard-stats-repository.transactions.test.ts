import { v4 as uuidv4 } from 'uuid'
import { getRiskScoreFromLevel } from '@flagright/lib/utils/risk'
import {
  getStatsRepo,
  getTransactionsRepo,
  hitRule,
  notHitRule,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/all'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'

withFeatureHook(['RISK_SCORING'])
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
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        status_ALLOW: 1,
      }),
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
      status: 'BLOCK',
      hitRules: [hitRule('BLOCK')],
      executedRules: [hitRule('BLOCK')],
    })
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      hitRules: [hitRule('SUSPEND')],
      status: 'SUSPEND',
      executedRules: [hitRule('SUSPEND')],
    })
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
      }),
      status: 'FLAG',
      hitRules: [hitRule('FLAG')],
      executedRules: [hitRule('FLAG')],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        status_FLAG: 1,
        status_BLOCK: 1,
        status_SUSPEND: 1,
      }),
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
      status: 'BLOCK',
      hitRules: hitRules,
      executedRules: hitRules,
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        status_BLOCK: 1,
      }),
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
      status: 'ALLOW',
      hitRules: [],
      executedRules: [notHitRule(), notHitRule(), notHitRule()],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        status_ALLOW: 1,
      }),
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
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      })
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
    }
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T01:00:00.000Z').valueOf(),
      dayjs('2022-01-30T03:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30T01',
        status_ALLOW: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T02',
        status_ALLOW: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T03',
        status_ALLOW: 1,
      }),
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
        status: 'SUSPEND',
        hitRules: [hitRule('SUSPEND')],
        executedRules: [],
      })
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
    }
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T01:00:00.000Z').valueOf(),
      dayjs('2022-01-30T03:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30T01',
        status_SUSPEND: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T02',
        status_SUSPEND: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T03',
        status_SUSPEND: 1,
      }),
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
        status: 'BLOCK',
        hitRules: [hitRule('BLOCK')],
        executedRules: [hitRule('BLOCK')],
      })
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
    }

    const hourlyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T04:00:00.000Z').valueOf(),
      'HOUR'
    )
    expect(hourlyStats).toEqual([
      expect.objectContaining({
        time: '2022-01-30T00',
      }),
      expect.objectContaining({
        time: '2022-01-30T01',
        status_BLOCK: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T02',
        status_BLOCK: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T03',
        status_BLOCK: 1,
      }),
      expect.objectContaining({
        time: '2022-01-30T04',
      }),
    ])
    const dailyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-29T00:00:00.000Z').valueOf(),
      dayjs('2022-01-31T00:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(dailyStats).toEqual([
      expect.objectContaining({
        time: '2022-01-29',
      }),
      expect.objectContaining({
        time: '2022-01-30',
        status_BLOCK: 3,
      }),
      expect.objectContaining({
        time: '2022-01-31',
      }),
    ])
    const monthlyStats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      dayjs('2022-02-01T00:00:00.000Z').valueOf(),
      'MONTH'
    )
    expect(monthlyStats).toEqual([
      expect.objectContaining({
        time: '2022-01',
        status_BLOCK: 3,
      }),
      expect.objectContaining({
        time: '2022-02',
      }),
    ])
  })
})

describe('Verify transactions counting ARS risk levels', () => {
  test('Single transaction with very high risk level', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
        arsScore: {
          createdAt: timestamp,
          arsScore: 100,
          riskLevel: 'VERY_HIGH',
        },
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )

    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        arsRiskLevel_VERY_HIGH: 1,
      }),
    ])
  })
  test('Every level with 5-4-3-2-1 count', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    for (let i = 0; i < RISK_LEVELS.length; i += 1) {
      const risklevel = RISK_LEVELS[i]
      for (let j = 0; j <= i; j += 1) {
        const arsScore = getRiskScoreFromLevel(
          DEFAULT_CLASSIFICATION_SETTINGS,
          risklevel
        )
        await transactionRepository.addTransactionToMongo({
          ...getTestTransaction({
            timestamp: timestamp,
            arsScore: {
              createdAt: timestamp,
              arsScore,
              riskLevel: risklevel,
            },
          }),
          status: 'ALLOW',
          hitRules: [],
          executedRules: [],
        })
      }
    }

    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        arsRiskLevel_VERY_HIGH: 1,
        arsRiskLevel_HIGH: 2,
        arsRiskLevel_MEDIUM: 3,
        arsRiskLevel_LOW: 4,
        arsRiskLevel_VERY_LOW: 5,
      }),
    ])
  })
})

describe('Verify transactions counting payment methods', () => {
  test('Single transaction with origin payment details', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
        destinationPaymentDetails: undefined,
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        paymentMethods_CARD: 1,
      }),
    ])
  })
  test('Single transaction with destination payment details', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
        originPaymentDetails: undefined,
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        paymentMethods_CARD: 1,
      }),
    ])
  })
  test('Single transaction with both payment details', async () => {
    const TENANT_ID = getTestTenantId()
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        timestamp: timestamp,
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await statsRepository.refreshTransactionStats({ startTimestamp: timestamp })
    const stats = await statsRepository.getTransactionCountStats(
      dayjs('2022-01-30T00:00:00.000Z').valueOf(),
      dayjs('2022-01-30T18:00:00.000Z').valueOf(),
      'DAY'
    )
    expect(stats).toEqual([
      expect.objectContaining({
        time: '2022-01-30',
        paymentMethods_CARD: 2,
      }),
    ])
  })
})
