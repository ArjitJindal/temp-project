import {
  getCaseRepo,
  getStatsRepo,
  getTransactionsRepo,
  hitRule,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'

dynamoDbSetupHook()

describe('Verify case stats', () => {
  test(`Single case`, async () => {
    const TENANT_ID = getTestTenantId()
    const caseRepository = await getCaseRepo(TENANT_ID)
    const statsRepository = await getStatsRepo(TENANT_ID)
    const transactionRepository = await getTransactionsRepo(TENANT_ID)

    const originUserId = 'test-user-id'
    const destinationUserId = 'test-user-id-2'
    const hitRules = [hitRule()]
    const transactions = [
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T12:00:00.000Z').valueOf(),
        }),
        status: 'BLOCK' as RuleAction,
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      },
      {
        ...getTestTransaction({
          timestamp: dayjs('2022-01-30T18:00:00.000Z').valueOf(),
        }),
        status: 'BLOCK' as RuleAction,
        hitRules: hitRules,
        executedRules: hitRules,
        originUserId: originUserId,
        destinationUserId: destinationUserId,
      },
    ]

    await Promise.all(
      transactions.map((t) => transactionRepository.addTransactionToMongo(t))
    )

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      caseType: 'SYSTEM',
      createdTimestamp,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      updatedAt: createdTimestamp,
    })
    await statsRepository.recalculateRuleHitStats({
      startTimestamp: createdTimestamp,
    })
    const stats = await statsRepository.getRuleHitCountStats(
      dayjs('2022-01-30T11:00:00.000Z').valueOf(),
      dayjs('2022-01-30T13:00:00.000Z').valueOf()
    )
    expect(stats).toEqual([
      {
        ruleId: 'R-1',
        ruleInstanceId: '1',
        hitCount: 2,
        casesCount: 1,
        openCasesCount: 1,
      },
    ])
  })
})

test(`Multiple cases`, async () => {
  const TENANT_ID = getTestTenantId()
  const caseRepository = await getCaseRepo(TENANT_ID)
  const statsRepository = await getStatsRepo(TENANT_ID)
  const transactionRepository = await getTransactionsRepo(TENANT_ID)

  const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

  const originUserId = 'test-user-id'
  const destinationUserId = 'test-user-id-2'
  const transaction = {
    ...getTestTransaction({
      timestamp,
    }),
    status: 'BLOCK' as RuleAction,
    hitRules: [hitRule()],
    executedRules: [hitRule()],
    originUserId: originUserId,
    destinationUserId: destinationUserId,
    caseAggregates: DEFAULT_CASE_AGGREGATES,
  }

  await transactionRepository.addTransactionToMongo(transaction)

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await statsRepository.recalculateRuleHitStats({ startTimestamp: timestamp })
  const stats = await statsRepository.getRuleHitCountStats(
    dayjs('2022-01-30T00:00:00.000Z').valueOf(),
    dayjs('2022-01-31T00:00:00.000Z').valueOf()
  )
  expect(stats).toEqual([
    {
      ruleId: 'R-1',
      ruleInstanceId: '1',
      hitCount: 3,
      casesCount: 3,
      openCasesCount: 3,
    },
  ])
})

test(`Multiple cases - opened and closed`, async () => {
  const TENANT_ID = getTestTenantId()
  const caseRepository = await getCaseRepo(TENANT_ID)
  const statsRepository = await getStatsRepo(TENANT_ID)
  const transactionRepository = await getTransactionsRepo(TENANT_ID)

  const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

  const originUserId = 'test-user-id'
  const destinationUserId = 'test-user-id-2'
  const transaction = {
    ...getTestTransaction({
      timestamp,
    }),
    status: 'BLOCK' as RuleAction,
    hitRules: [hitRule()],
    executedRules: [hitRule()],
    originUserId: originUserId,
    destinationUserId: destinationUserId,
  }

  await transactionRepository.addTransactionToMongo(transaction)

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseStatus: 'OPEN',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await caseRepository.addCaseMongo({
    caseType: 'SYSTEM',
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseStatus: 'CLOSED',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseStatus: 'OPEN',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-4',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseStatus: 'REOPENED',
    caseTransactionsIds: [transaction.transactionId],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
    updatedAt: timestamp,
  })
  await statsRepository.recalculateRuleHitStats({ startTimestamp: timestamp })
  const stats = await statsRepository.getRuleHitCountStats(
    dayjs('2022-01-30T00:00:00.000Z').valueOf(),
    dayjs('2022-01-31T00:00:00.000Z').valueOf()
  )
  expect(stats).toEqual([
    {
      ruleId: 'R-1',
      ruleInstanceId: '1',
      hitCount: 4,
      casesCount: 4,
      openCasesCount: 3,
    },
  ])
})
