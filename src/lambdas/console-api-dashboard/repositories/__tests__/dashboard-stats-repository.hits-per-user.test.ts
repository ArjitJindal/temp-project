import { getCaseRepo, getStatsRepo, hitRule, notHitRule } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

dynamoDbSetupHook()

describe('Verify hits-per-user statistics', () => {
  test('Single transaction with single hit', async () => {
    const TENANT_ID = getTestTenantId()
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
      hitRules: hitRules,
      executedRules: hitRules,
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    }

    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      caseType: 'TRANSACTION',
      caseTransactions: [transaction],
      caseTransactionsIds: [transaction.transactionId],
    })
    await statsRepository.refreshTransactionStats(timestamp)
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
          transactionCasesCount: 1,
          userCasesCount: 0,
          openTransactionCasesCount: 1,
          openUserCasesCount: 0,
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
          transactionCasesCount: 1,
          userCasesCount: 0,
          openTransactionCasesCount: 1,
          openUserCasesCount: 0,
        }),
      ])
    }
  })
  test('Single transaction with uneven executed and hit rules', async () => {
    const TENANT_ID = getTestTenantId()
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
      hitRules: hitRules,
      executedRules: [...hitRules, notHitRule('BLOCK'), notHitRule('FLAG')],
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    }

    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      caseType: 'TRANSACTION',
      caseTransactions: [transaction],
      caseTransactionsIds: [transaction.transactionId],
    })
    await statsRepository.refreshTransactionStats(timestamp)
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
          transactionCasesCount: 1,
          userCasesCount: 0,
          openTransactionCasesCount: 1,
          openUserCasesCount: 0,
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
          transactionCasesCount: 1,
          userCasesCount: 0,
          openTransactionCasesCount: 1,
          openUserCasesCount: 0,
        }),
      ])
    }
  })
  test('Multiple transaction with hits should sum up', async () => {
    const TENANT_ID = getTestTenantId()
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
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      }
      await caseRepository.addCaseMongo({
        caseId: `C-${i}`,
        caseType: 'USER',
        caseTransactions: [transaction],
        caseTransactionsIds: [transaction.transactionId],
      })
      await statsRepository.refreshTransactionStats(timestamp)
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
          transactionCasesCount: 0,
          userCasesCount: transactionsCount,
          openTransactionCasesCount: 0,
          openUserCasesCount: transactionsCount,
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
          transactionCasesCount: 0,
          userCasesCount: transactionsCount,
          openTransactionCasesCount: 0,
          openUserCasesCount: transactionsCount,
        }),
      ])
    }
  })
  test('Large amount of transactions', async () => {
    const TENANT_ID = getTestTenantId()
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)

    const initialTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const transactionsCount = 100

    const hitRules = [hitRule()]

    for (let i = 0; i < transactionsCount; i += 1) {
      const timestamp = initialTimestamp + 3600 * 1000 * i
      const transaction = {
        ...getTestTransaction({
          timestamp,
        }),
        hitRules: hitRules,
        executedRules: [...hitRules, notHitRule()],
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      }
      await caseRepository.addCaseMongo({
        caseId: `C-${i}`,
        caseType: 'TRANSACTION',
        caseTransactions: [transaction],
        caseTransactionsIds: [transaction.transactionId],
      })
      await statsRepository.refreshTransactionStats(timestamp)
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
          rulesHit: transactionsCount,
          transactionCasesCount: transactionsCount,
          userCasesCount: 0,
          openTransactionCasesCount: transactionsCount,
          openUserCasesCount: 0,
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
          rulesHit: transactionsCount,
          transactionCasesCount: transactionsCount,
          userCasesCount: 0,
          openTransactionCasesCount: transactionsCount,
          openUserCasesCount: 0,
        }),
      ])
    }
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
