import { getCaseRepo, getStatsRepo, hitRule, notHitRule } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import { RuleAction } from '@/@types/openapi-public/RuleAction'

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

    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: timestamp,
      caseTransactions: [transaction],
      caseTransactionsIds: [transaction.transactionId],
      caseUsers: {
        origin: getTestUser({ userId: originUserId }),
        destination: getTestUser({ userId: destinationUserId }),
      },
      caseType: 'SYSTEM',
    })
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: timestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          transactionsHit: 1,
          rulesHit: hitRules.length,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          transactionsHit: 1,
          rulesHit: hitRules.length,
          casesCount: 1,
          openCasesCount: 1,
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

    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: timestamp,
      caseTransactions: [transaction],
      caseTransactionsIds: [transaction.transactionId],
      caseUsers: {
        origin: getTestUser({ userId: originUserId }),
        destination: getTestUser({ userId: destinationUserId }),
      },
      caseType: 'SYSTEM',
    })
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: timestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          transactionsHit: 1,
          rulesHit: hitRules.length,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          transactionsHit: 1,
          rulesHit: hitRules.length,
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
    const hitRulesCount = 3
    const transactionsCount = 10

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
        caseTransactions: [transaction],
        caseTransactionsIds: [transaction.transactionId],
        caseUsers: {
          origin: getTestUser({ userId: originUserId }),
          destination: getTestUser({ userId: destinationUserId }),
        },
        caseType: 'SYSTEM',
      })
      await statsRepository.recalculateHitsByUser('ORIGIN', {
        startTimestamp: timestamp,
      })
      await statsRepository.recalculateHitsByUser('DESTINATION', {
        startTimestamp: timestamp,
      })
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          transactionsHit: transactionsCount,
          rulesHit: hitRulesCount * transactionsCount,
          casesCount: transactionsCount,
          openCasesCount: transactionsCount,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          transactionsHit: transactionsCount,
          rulesHit: hitRulesCount * transactionsCount,
          casesCount: transactionsCount,
          openCasesCount: transactionsCount,
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
        caseTransactions: [transaction],
        caseTransactionsIds: [transaction.transactionId],
        caseUsers: {
          origin: getTestUser({ userId: originUserId }),
          destination: getTestUser({ userId: destinationUserId }),
        },
        caseType: 'SYSTEM',
      })
      await statsRepository.recalculateHitsByUser('ORIGIN', {
        startTimestamp: timestamp,
      })
      await statsRepository.recalculateHitsByUser('DESTINATION', {
        startTimestamp: timestamp,
      })
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'ORIGIN'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          transactionsHit: casesCount,
          rulesHit: casesCount,
          casesCount: casesCount,
          openCasesCount: casesCount,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        0,
        Number.MAX_SAFE_INTEGER,
        'DESTINATION'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          transactionsHit: casesCount,
          rulesHit: casesCount,
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
      caseTransactions: [transaction],
      caseTransactionsIds: [transaction.transactionId],
    })
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: timestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
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

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseType: 'SYSTEM',
      caseId: 'C-1',
      createdTimestamp,
      caseTransactions: transactions,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      caseUsers: {
        origin: getTestUser({ userId: originUserId }),
        destination: getTestUser({ userId: destinationUserId }),
      },
    })
    await statsRepository.recalculateHitsByUser('ORIGIN', {
      startTimestamp: createdTimestamp,
    })
    await statsRepository.recalculateHitsByUser('DESTINATION', {
      startTimestamp: createdTimestamp,
    })
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        'ORIGIN'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: originUserId,
          transactionsHit: 2,
          rulesHit: hitRules.length * 2,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
    {
      const stats = await statsRepository.getHitsByUserStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T13:00:00.000Z').valueOf(),
        'DESTINATION'
      )
      expect(stats).toEqual([
        expect.objectContaining({
          userId: destinationUserId,
          transactionsHit: 2,
          rulesHit: hitRules.length * 2,
          casesCount: 1,
          openCasesCount: 1,
        }),
      ])
    }
  })
})
