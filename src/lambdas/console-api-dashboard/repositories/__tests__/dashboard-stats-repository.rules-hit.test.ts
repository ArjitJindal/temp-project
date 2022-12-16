import { getCaseRepo, getStatsRepo, hitRule } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { CaseType } from '@/@types/openapi-internal/CaseType'

dynamoDbSetupHook()

describe.each([{ caseType: 'TRANSACTION' }, { caseType: 'USER' }])(
  '',
  ({ caseType }) => {
    test(`Single case - ${caseType}`, async () => {
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
        caseType: caseType as CaseType,
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
          transactionCasesCount: caseType === 'TRANSACTION' ? 1 : 0,
          userCasesCount: caseType === 'USER' ? 1 : 0,
          openTransactionCasesCount: caseType === 'TRANSACTION' ? 1 : 0,
          openUserCasesCount: caseType === 'USER' ? 1 : 0,
        },
      ])
    })
  }
)

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
    caseType: 'TRANSACTION',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseType: 'TRANSACTION',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    createdTimestamp: timestamp,
    caseType: 'USER',
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
      transactionCasesCount: 2,
      userCasesCount: 1,
      openTransactionCasesCount: 2,
      openUserCasesCount: 1,
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
    caseType: 'TRANSACTION',
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseType: 'TRANSACTION',
    caseStatus: 'CLOSED',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    createdTimestamp: timestamp,
    caseType: 'USER',
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-4',
    createdTimestamp: timestamp,
    caseType: 'USER',
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
      transactionCasesCount: 2,
      openTransactionCasesCount: 1,
      userCasesCount: 2,
      openUserCasesCount: 2,
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
