import { getCaseRepo, getStatsRepo, hitRule } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'

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

    const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      caseType: 'SYSTEM',
      createdTimestamp,
      caseTransactions: transactions,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
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

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
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

  await caseRepository.addCaseMongo({
    caseId: 'C-1',
    createdTimestamp: timestamp,
    caseType: 'SYSTEM',
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseType: 'SYSTEM',
    caseId: 'C-2',
    createdTimestamp: timestamp,
    caseStatus: 'CLOSED',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-3',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseStatus: 'OPEN',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
  })
  await caseRepository.addCaseMongo({
    caseId: 'C-4',
    caseType: 'SYSTEM',
    createdTimestamp: timestamp,
    caseStatus: 'REOPENED',
    caseTransactions: [transaction],
    caseTransactionsIds: [transaction.transactionId],
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
