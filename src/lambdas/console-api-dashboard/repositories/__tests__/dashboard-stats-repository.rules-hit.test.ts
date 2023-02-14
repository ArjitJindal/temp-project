import { getCaseRepo, getStatsRepo, hitRule } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

dynamoDbSetupHook()

describe('Verify case stats', () => {
  test(`Single case`, async () => {
    const TENANT_ID = getTestTenantId()
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
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T18:00:00.000Z').valueOf(),
        }),
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      },
    ]

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp,
      caseTransactions: transactions,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
    })
    await statsRepository.recalculateRuleHitStats(createdTimestamp)
    const stats = await statsRepository.getRuleHitCountStats(
      dayjs('2022-01-30T11:00:00.000Z').valueOf(),
      dayjs('2022-01-30T13:00:00.000Z').valueOf()
    )
    expect(stats).toEqual([
      {
        ruleId: 'R-1',
        ruleInstanceId: '1',
        hitCount: 2,
        transactionCasesCount: 0,
        userCasesCount: 1,
        openTransactionCasesCount: 0,
        openUserCasesCount: 1,
      },
    ])
  })
})

test(`Multiple cases`, async () => {
  const TENANT_ID = getTestTenantId()
  const caseRepository = await getCaseRepo(TENANT_ID)
  const statsRepository = await getStatsRepo(TENANT_ID)

  const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

  const originUserId = 'test-user-id'
  const destinationUserId = 'test-user-id-2'
  const transaction = {
    ...getTestTransaction({
      timestamp,
    }),
    hitRules: [hitRule()],
    executedRules: [hitRule()],
    originUserId: originUserId,
    destinationUserId: destinationUserId,
  }

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    createdTimestamp: timestamp,
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await statsRepository.recalculateRuleHitStats(timestamp)
  const stats = await statsRepository.getRuleHitCountStats(
    dayjs('2022-01-30T00:00:00.000Z').valueOf(),
    dayjs('2022-01-31T00:00:00.000Z').valueOf()
  )
  expect(stats).toEqual([
    {
      ruleId: 'R-1',
      ruleInstanceId: '1',
      hitCount: 3,
      transactionCasesCount: 0,
      userCasesCount: 3,
      openTransactionCasesCount: 0,
      openUserCasesCount: 3,
    },
  ])
})

test(`Multiple cases - opened and closed`, async () => {
  const TENANT_ID = getTestTenantId()
  const caseRepository = await getCaseRepo(TENANT_ID)
  const statsRepository = await getStatsRepo(TENANT_ID)

  const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

  const originUserId = 'test-user-id'
  const destinationUserId = 'test-user-id-2'
  const transaction = {
    ...getTestTransaction({
      timestamp,
    }),
    hitRules: [hitRule()],
    executedRules: [hitRule()],
    originUserId: originUserId,
    destinationUserId: destinationUserId,
  }

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseStatus: 'CLOSED',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    createdTimestamp: timestamp,
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-4',
    createdTimestamp: timestamp,
    caseStatus: 'REOPENED',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await statsRepository.recalculateRuleHitStats(timestamp)
  const stats = await statsRepository.getRuleHitCountStats(
    dayjs('2022-01-30T00:00:00.000Z').valueOf(),
    dayjs('2022-01-31T00:00:00.000Z').valueOf()
  )
  expect(stats).toEqual([
    {
      ruleId: 'R-1',
      ruleInstanceId: '1',
      hitCount: 4,
      transactionCasesCount: 0,
      openTransactionCasesCount: 0,
      userCasesCount: 4,
      openUserCasesCount: 3,
    },
  ])
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
