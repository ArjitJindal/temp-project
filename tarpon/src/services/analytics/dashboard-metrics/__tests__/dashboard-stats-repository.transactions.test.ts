import { v4 as uuidv4 } from 'uuid'
import { getRiskScoreFromLevel } from '@flagright/lib/utils/risk'
import {
  getStatsRepo,
  getTransactionsRepo,
  hitRule,
  notHitRule,
  getTransactionsEventRepo,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { Transaction } from '@/@types/openapi-internal/Transaction'

type RuleResult = {
  executedRules: Array<ExecutedRulesResult>
  hitRules: Array<HitRulesDetails>
  status: RuleAction
}

const createTransactionAndEvent = async (
  transactionRepository: MongoDbTransactionRepository,
  transactionEventRepository: TransactionEventRepository,
  transaction: Transaction,
  ruleResult: RuleResult
) => {
  await transactionRepository.addTransactionToMongo({
    ...transaction,
    ...ruleResult,
  })
  await transactionEventRepository.saveTransactionEventToMongo(
    {
      transactionState: transaction.transactionState ?? 'CREATED',
      timestamp: transaction.timestamp,
      transactionId: transaction.transactionId,
    },
    ruleResult
  )
}

withFeaturesToggled(['RISK_SCORING'], ['CLICKHOUSE_ENABLED'], () => {
  describe('Verify transactions counting statistics', () => {
    test('Single transaction with no hits should only count 1 total transaction', async () => {
      const TENANT_ID = getTestTenantId()
      const transactionRepository = await getTransactionsRepo(TENANT_ID)
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()
      const transaction = getTestTransaction({
        timestamp: timestamp,
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()

      const transaction1 = getTestTransaction({
        timestamp: timestamp,
      })
      const ruleResult1: RuleResult = {
        status: 'BLOCK',
        hitRules: [hitRule('BLOCK')],
        executedRules: [hitRule('BLOCK')],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction1,
        ruleResult1
      )

      const transaction2 = getTestTransaction({
        timestamp: timestamp + 1000,
      })
      const ruleResult2: RuleResult = {
        status: 'SUSPEND',
        hitRules: [hitRule('SUSPEND')],
        executedRules: [hitRule('SUSPEND')],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction2,
        ruleResult2
      )

      const transaction3 = getTestTransaction({
        timestamp: timestamp + 2000,
      })
      const ruleResult3: RuleResult = {
        status: 'FLAG',
        hitRules: [hitRule('FLAG')],
        executedRules: [hitRule('FLAG')],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction3,
        ruleResult3
      )

      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()

      const hitRules = [
        hitRule('SUSPEND'),
        hitRule('FLAG'),
        hitRule('BLOCK'),
        hitRule('ALLOW'),
      ]

      const transaction = getTestTransaction({
        timestamp: timestamp,
      })
      const ruleResult: RuleResult = {
        status: 'BLOCK',
        hitRules: hitRules,
        executedRules: hitRules,
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()
      const transaction = getTestTransaction({
        timestamp: timestamp,
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [notHitRule(), notHitRule(), notHitRule()],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)
      const d = dayjs('2022-01-30T01:00:00.000Z')
      const initialTimestamp = d.valueOf()
      for (let i = 0; i < 3; i += 1) {
        const timestamp = initialTimestamp + i * 3600 * 1000
        const transaction = getTestTransaction({
          timestamp: timestamp,
        })
        const ruleResult: RuleResult = {
          status: 'ALLOW',
          hitRules: [],
          executedRules: [],
        }
        await createTransactionAndEvent(
          transactionRepository,
          transactionEventRepository,
          transaction,
          ruleResult
        )
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T01:00:00.000Z')
      const initialTimestamp = d.valueOf()

      for (let i = 0; i < 3; i += 1) {
        const timestamp = initialTimestamp + i * 3600 * 1000
        const transaction = getTestTransaction({
          timestamp: timestamp,
        })
        const ruleResult: RuleResult = {
          status: 'SUSPEND',
          hitRules: [hitRule('SUSPEND')],
          executedRules: [],
        }
        await createTransactionAndEvent(
          transactionRepository,
          transactionEventRepository,
          transaction,
          ruleResult
        )
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const initialTimestamp = dayjs('2022-01-30T01:00:00.000Z').valueOf()
      for (let i = 0; i < 3; i += 1) {
        const timestamp = initialTimestamp + i * 3600 * 1000
        const transaction = getTestTransaction({
          timestamp: timestamp,
        })
        const ruleResult: RuleResult = {
          status: 'BLOCK',
          hitRules: [hitRule('BLOCK')],
          executedRules: [hitRule('BLOCK')],
        }
        await createTransactionAndEvent(
          transactionRepository,
          transactionEventRepository,
          transaction,
          ruleResult
        )
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()
      const transaction = getTestTransaction({
        timestamp: timestamp,
        arsScore: {
          createdAt: timestamp,
          arsScore: 100,
          riskLevel: 'VERY_HIGH',
        },
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
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
          const transaction = getTestTransaction({
            timestamp: timestamp,
            arsScore: {
              createdAt: timestamp,
              arsScore,
              riskLevel: risklevel,
            },
          })
          const ruleResult: RuleResult = {
            status: 'ALLOW',
            hitRules: [],
            executedRules: [],
          }
          await createTransactionAndEvent(
            transactionRepository,
            transactionEventRepository,
            transaction,
            ruleResult
          )
        }
      }

      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()

      const transaction = getTestTransaction({
        timestamp: timestamp,
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
        destinationPaymentDetails: undefined,
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()

      const transaction = getTestTransaction({
        timestamp: timestamp,
        originPaymentDetails: undefined,
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )

      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
      const transactionEventRepository = await getTransactionsEventRepo(
        TENANT_ID
      )
      const statsRepository = await getStatsRepo(TENANT_ID)

      const d = dayjs('2022-01-30T12:00:00.000Z')
      const timestamp = d.valueOf()

      const transaction = getTestTransaction({
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
      })
      const ruleResult: RuleResult = {
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      }
      await createTransactionAndEvent(
        transactionRepository,
        transactionEventRepository,
        transaction,
        ruleResult
      )
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
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
})
