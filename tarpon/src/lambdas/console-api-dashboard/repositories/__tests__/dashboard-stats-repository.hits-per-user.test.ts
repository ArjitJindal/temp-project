import {
  getCaseRepo,
  getStatsRepo,
  getTransactionsRepo,
  getUserRepo,
  hitRule,
  notHitRule,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'

dynamoDbSetupHook()

describe('Verify hits-per-user statistics', () => {
  test('Single transaction with single hit', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)
    const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]
    const transaction = {
      ...getTestTransaction({
        timestamp,
      }),
      status: 'BLOCK' as RuleAction,
      hitRules: hitRules,
      executedRules: hitRules,
      originUserId,
      destinationUserId,
    }
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    await transactionRepository.addTransactionToMongo(transaction)
    const userRepository = await getUserRepo(TENANT_ID)
    await userRepository.saveUserMongo(
      getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
    )
    await userRepository.saveUserMongo(
      getTestUser({
        userId: destinationUserId,
        type: 'BUSINESS',
      }) as InternalUser
    )
    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: timestamp,
      caseTransactionsIds: [transaction.transactionId],
      caseUsers: {
        origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
        destination: getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }),
      },
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: timestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: timestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: 1,
          casesCount: 1,
          openCasesCount: 1,
          rulesRunCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: 1,
          casesCount: 1,
          openCasesCount: 1,
          rulesRunCount: 1,
        }),
      ])
    }
  })
  test('Single transaction with uneven executed and hit rules', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const d = dayjs('2022-01-30T12:00:00.000Z')
    const timestamp = d.valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule('BLOCK'), hitRule('FLAG'), hitRule('BLOCK')]
    const transaction = {
      ...getTestTransaction({
        timestamp,
      }),
      status: 'BLOCK' as RuleAction,
      hitRules: hitRules,
      executedRules: [...hitRules, notHitRule('BLOCK'), notHitRule('FLAG')],
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    }
    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    await transactionRepository.addTransactionToMongo(transaction)

    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: timestamp,
      caseTransactionsIds: [transaction.transactionId],
      caseUsers: {
        origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
        destination: getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }),
      },
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    const userRepository = await getUserRepo(TENANT_ID)
    await userRepository.saveUserMongo(
      getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
    )
    await userRepository.saveUserMongo(
      getTestUser({
        userId: destinationUserId,
        type: 'BUSINESS',
      }) as InternalUser
    )

    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: timestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: timestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: 3,
          casesCount: 1,
          openCasesCount: 1,
          rulesRunCount: 5,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: 3,
          rulesRunCount: 5,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
  })
  test('Multiple transaction with hits should sum up', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRulesCount = 1
    const transactionsCount = 3

    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    for (let i = 0; i < transactionsCount; i += 1) {
      const hitRules = [...new Array(hitRulesCount)].map(() => hitRule())
      const timestamp = initialTimestamp + 3600 * 1000 * i
      const transaction = {
        ...getTestTransaction({
          timestamp,
        }),
        status: 'BLOCK' as RuleAction,
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      }
      await caseRepository.addCaseMongo({
        caseId: `C-${i}`,
        createdTimestamp: timestamp,
        caseTransactionsIds: [transaction.transactionId],
        caseUsers: {
          origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
          destination: getTestUser({
            userId: destinationUserId,
            type: 'BUSINESS',
          }),
        },
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })

      await transactionRepository.addTransactionToMongo(transaction)
      const userRepository = await getUserRepo(TENANT_ID)
      await userRepository.saveUserMongo(
        getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
      )
      await userRepository.saveUserMongo(
        getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }) as InternalUser
      )

      await statsRepository.recalculateHitsByUser('ORIGIN', {
        startTimestamp: timestamp,
      })
      await statsRepository.recalculateHitsByUser('DESTINATION', {
        startTimestamp: timestamp,
      })
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: 3,
          rulesRunCount: 3,
          casesCount: 3,
          openCasesCount: 3,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: 3,
          rulesRunCount: 3,
          casesCount: 3,
          openCasesCount: 3,
        }),
      ])
    }
  })
  test('Large amount of transactions', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const casesCount = 100

    const hitRules = [hitRule()]

    const transactionRepository = await getTransactionsRepo(TENANT_ID)
    for (let i = 0; i < casesCount; i += 1) {
      const timestamp = initialTimestamp + 3600 * 1000 * i
      const transaction = {
        ...getTestTransaction({
          timestamp,
        }),
        status: 'BLOCK' as RuleAction,
        hitRules: hitRules,
        executedRules: [...hitRules, notHitRule()],
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      }
      await caseRepository.addCaseMongo({
        caseId: `C-${i}`,
        createdTimestamp: timestamp,
        caseTransactionsIds: [transaction.transactionId],
        caseUsers: {
          origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
          destination: getTestUser({
            userId: destinationUserId,
            type: 'BUSINESS',
          }),
        },
        caseType: 'SYSTEM',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await transactionRepository.addTransactionToMongo(transaction)
      const userRepository = await getUserRepo(TENANT_ID)
      await userRepository.saveUserMongo(
        getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
      )
      await userRepository.saveUserMongo(
        getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }) as InternalUser
      )

      await statsRepository.recalculateHitsByUser('ORIGIN', {
        startTimestamp: timestamp,
      })
      await statsRepository.recalculateHitsByUser('DESTINATION', {
        startTimestamp: timestamp,
      })
      await statsRepository.refreshTransactionStats({
        startTimestamp: timestamp,
      })
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: casesCount,
          rulesRunCount: 2 * casesCount,
          casesCount: casesCount,
          openCasesCount: casesCount,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: casesCount,
          rulesRunCount: 2 * casesCount,
          casesCount: casesCount,
          openCasesCount: casesCount,
        }),
      ])
    }
  })

  test('Transactions with unknown origin/destination user should not e aggregated', async () => {
    const TENANT_ID = getTestTenantId()
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'unknown-user-1'
    const destinationUserId = 'unknown-user-2'
    const hitRules = [hitRule()]
    const transaction = {
      ...getTestTransaction({
        timestamp,
      }),
      status: 'BLOCK' as RuleAction,
      hitRules: hitRules,
      executedRules: hitRules,
      originUserId,
      destinationUserId,
    }

    await caseRepository.addCaseMongo({
      caseType: 'SYSTEM',
      caseId: 'C-1',
      caseTransactionsIds: [transaction.transactionId],
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })

    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: timestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: timestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toEqual([])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toEqual([])
    }
  })

  test('Single case multiple transactions across hours', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)
    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]
    const transactionsRepository = await getTransactionsRepo(TENANT_ID)
    const transactions = [
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T12:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T20:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
    ]

    await transactionsRepository.addTransactionToMongo(transactions[0])
    await transactionsRepository.addTransactionToMongo(transactions[1])

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseType: 'SYSTEM',
      caseId: 'C-1',
      createdTimestamp,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      caseUsers: {
        origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
        destination: getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }),
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    const userRepository = await getUserRepo(TENANT_ID)
    await userRepository.saveUserMongo(
      getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
    )
    await userRepository.saveUserMongo(
      getTestUser({
        userId: destinationUserId,
        type: 'BUSINESS',
      }) as InternalUser
    )
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: createdTimestamp,
    })

    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: 1,
          rulesRunCount: 1,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: 1,
          rulesRunCount: 1,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
  })

  test('Multiple transactions across hours', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)
    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]
    const transactionsRepository = await getTransactionsRepo(TENANT_ID)
    const transactions = [
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T12:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T14:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T15:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T16:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
    ]
    for (let i = 0; i < transactions.length; i++) {
      await transactionsRepository.addTransactionToMongo(transactions[i])
    }

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseType: 'SYSTEM',
      caseId: 'C-1',
      createdTimestamp,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      caseUsers: {
        origin: getTestUser({ userId: originUserId, type: 'BUSINESS' }),
        destination: getTestUser({
          userId: destinationUserId,
          type: 'BUSINESS',
        }),
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    })
    const userRepository = await getUserRepo(TENANT_ID)
    await userRepository.saveUserMongo(
      getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
    )
    await userRepository.saveUserMongo(
      getTestUser({
        userId: destinationUserId,
        type: 'BUSINESS',
      }) as InternalUser
    )
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: createdTimestamp,
      endTimestamp: dayjs('2022-01-30T17:00:00.000Z').valueOf(),
    })

    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T17:00:00.000Z').valueOf(),
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          rulesHitCount: 4,
          rulesRunCount: 5,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T15:00:00.000Z').valueOf(),
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          rulesHitCount: 3,
          rulesRunCount: 4,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
  })

  test('Multiple transactions across hours with no hits', async () => {
    const TENANT_ID = getTestTenantId()
    await createConsumerUsers(TENANT_ID, [
      getTestUser({ userId: 'test-user-id' }),
      getTestUser({ userId: 'test-user-id-2' }),
    ])
    const statsRepository = await getStatsRepo(TENANT_ID)
    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]
    const transactionsRepository = await getTransactionsRepo(TENANT_ID)
    const transactions = [
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T12:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T14:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T15:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T16:00:00.000Z').valueOf(),
        }),
        hitRules: [],
        executedRules: hitRules,
        status: 'BLOCK' as RuleAction,
        originUserId,
        destinationUserId,
      },
    ]
    for (let i = 0; i < transactions.length; i++) {
      await transactionsRepository.addTransactionToMongo(transactions[i])
    }

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    const userRepository = await getUserRepo(TENANT_ID)
    await userRepository.saveUserMongo(
      getTestUser({ userId: originUserId, type: 'BUSINESS' }) as InternalUser
    )
    await userRepository.saveUserMongo(
      getTestUser({
        userId: destinationUserId,
        type: 'BUSINESS',
      }) as InternalUser
    )
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.refreshTransactionStats({
      startTimestamp: createdTimestamp,
      endTimestamp: dayjs('2022-01-30T17:00:00.000Z').valueOf(),
    })

    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T17:00:00.000Z').valueOf(),
        'ORIGIN',
        'BUSINESS'
      )
      expect(stats).toEqual([])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T15:00:00.000Z').valueOf(),
        'DESTINATION',
        'BUSINESS'
      )
      expect(stats).toEqual([])
    }
  })
})
