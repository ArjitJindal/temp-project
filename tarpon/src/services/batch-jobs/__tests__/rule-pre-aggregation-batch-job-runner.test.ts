import { BatchJobRepository } from '../repositories/batch-job-repository'
import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  BatchJobInDb,
  BatchJobWithId,
  RulePreAggregationBatchJob,
} from '@/@types/batch-job'
import dayjs from '@/utils/dayjs'
import * as v8Engine from '@/services/rules-engine/v8-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestRuleInstance } from '@/test-utils/rule-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getTestV8RiskFactor } from '@/test-utils/pulse-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { generateChecksum } from '@/utils/object'

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V8', 'RISK_FACTORS_V8'])
withLocalChangeHandler()

const dynamoDb = getDynamoDbClient()

const sendAggregationTaskMock = jest.spyOn(v8Engine, 'sendAggregationTask')
sendAggregationTaskMock.mockImplementation((task) =>
  Promise.resolve(
    task.userKeyId ?? generateChecksum((task as any).paymentDetails)
  )
)

async function setUpAggregationVariables(
  tenantId: string,
  aggregationVariables: RuleAggregationVariable[]
): Promise<{ ruleInstanceId: string }> {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstance = getTestRuleInstance({
    logic: { and: [] },
    logicAggregationVariables: aggregationVariables,
  })
  await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
  return { ruleInstanceId: ruleInstance.id as string }
}

async function setUpAggregationVariablesRiskFactors(
  tenantId: string,
  aggregationVariables: RuleAggregationVariable[]
): Promise<{ riskFactorId: string }> {
  const riskRepository = new RiskRepository(tenantId, {
    dynamoDb,
  })
  const riskFactor = getTestV8RiskFactor({
    logicAggregationVariables: aggregationVariables,
    id: 'risk-factor-id',
  })
  await riskRepository.createOrUpdateParameterRiskItemV8(riskFactor)

  return { riskFactorId: riskFactor.id }
}

async function createJob(tenantId: string, job: BatchJobWithId) {
  const repo = new BatchJobRepository(tenantId, await getMongoDbClient())
  await repo.insertJob(job)
}

async function getJob(tenantId: string, jobId: string): Promise<BatchJobInDb> {
  const repo = new BatchJobRepository(tenantId, await getMongoDbClient())
  return (await repo.getJobById(jobId)) as BatchJobInDb
}

describe('Rule/Risk Factor pre-aggregation job runner', () => {
  const tenantId = getTestTenantId()
  const now = dayjs()

  beforeEach(() => {
    sendAggregationTaskMock.mockClear()
  })

  setUpTransactionsHooks(tenantId, [
    getTestTransaction({
      originUserId: 'U-1',
      destinationUserId: 'U-2',
      originPaymentDetails: undefined,
      destinationPaymentDetails: undefined,
      timestamp: now.valueOf(),
    }),
    getTestTransaction({
      originUserId: 'U-1',
      destinationUserId: 'U-3',
      originPaymentDetails: undefined,
      destinationPaymentDetails: undefined,
      timestamp: now.subtract(1, 'day').valueOf(),
    }),
    getTestTransaction({
      originUserId: 'U-3',
      destinationUserId: 'U-4',
      originPaymentDetails: undefined,
      destinationPaymentDetails: undefined,
      timestamp: now.subtract(2, 'day').valueOf(),
    }),
    getTestTransaction({
      originUserId: undefined,
      destinationUserId: undefined,
      originPaymentDetails: { method: 'CARD', cardFingerprint: 'card-1' },
      destinationPaymentDetails: { method: 'CARD', cardFingerprint: 'card-2' },
      timestamp: now.valueOf(),
    }),
    getTestTransaction({
      originUserId: undefined,
      destinationUserId: undefined,
      originPaymentDetails: { method: 'IBAN', BIC: 'bic-1', IBAN: 'iban-1' },
      destinationPaymentDetails: {
        method: 'IBAN',
        BIC: 'bic-2',
        IBAN: 'iban-2',
      },
      timestamp: now.subtract(1, 'day').valueOf(),
    }),
    getTestTransaction({
      originUserId: undefined,
      destinationUserId: undefined,
      originPaymentDetails: {
        method: 'WALLET',
        walletId: 'wallet-1',
        walletType: 'type',
      },
      destinationPaymentDetails: {
        method: 'WALLET',
        walletId: 'wallet-2',
        walletType: 'type',
      },
      timestamp: now.subtract(2, 'day').valueOf(),
    }),
  ])

  test('submits pre-aggregation tasks for the users in the target time range and direction - 1', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'USER_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    expect(sendAggregationTaskMock.mock.calls.map((v) => v[0])).toEqual([
      {
        userKeyId: 'U-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          userId: 'U-1',
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
    ])
  })

  test('submits pre-aggregation tasks for the users in the target time range and direction - 2', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'USER_TRANSACTIONS',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 3, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const sentTasks = sendAggregationTaskMock.mock.calls.map((v) => v[0])
    const expectedSentTasks = [
      {
        userKeyId: 'U-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          userId: 'U-1',
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'U-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          userId: 'U-2',
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'U-3',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          userId: 'U-3',
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'U-4',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          userId: 'U-4',
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
    ]
    expect(sentTasks.length).toBe(expectedSentTasks.length)
    expect(sentTasks).toEqual(expect.arrayContaining(expectedSentTasks))
  })

  test('submits pre-aggregation tasks for the payment details in the target time range and direction - 1', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    expect(sendAggregationTaskMock.mock.calls.map((v) => v[0])).toEqual([
      {
        userKeyId: 'cardFingerprint:card-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: { method: 'CARD', cardFingerprint: 'card-1' },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
    ])
  })

  test('submits pre-aggregation tasks for the payment details in the target time range and direction - 2', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 3, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const sentTasks = sendAggregationTaskMock.mock.calls.map((v) => v[0])
    const expectedSentTasks = [
      {
        userKeyId: 'BIC:bic-1#IBAN:iban-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'IBAN',
            BIC: 'bic-1',
            IBAN: 'iban-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'BIC:bic-2#IBAN:iban-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'IBAN',
            BIC: 'bic-2',
            IBAN: 'iban-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'cardFingerprint:card-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'CARD',
            cardFingerprint: 'card-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'cardFingerprint:card-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'CARD',
            cardFingerprint: 'card-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'walletId:wallet-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'WALLET',
            walletId: 'wallet-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
      {
        userKeyId: 'walletId:wallet-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'WALLET',
            walletId: 'wallet-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RULE', ruleInstanceId },
          jobId: 'test-job-id',
          ruleInstanceId,
        },
      },
    ]
    expect(sentTasks.length).toBe(expectedSentTasks.length)
    expect(sentTasks).toEqual(expect.arrayContaining(expectedSentTasks))
  })

  test('submits pre-aggregation tasks for the users in the target time range and direction - 1 (risk factor)', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 3, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { riskFactorId } = await setUpAggregationVariablesRiskFactors(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RISK_FACTOR', riskFactorId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const sentTasks = sendAggregationTaskMock.mock.calls.map((v) => v[0])
    const expectedSentTasks = [
      {
        userKeyId: 'BIC:bic-1#IBAN:iban-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'IBAN',
            BIC: 'bic-1',
            IBAN: 'iban-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
      {
        userKeyId: 'BIC:bic-2#IBAN:iban-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'IBAN',
            BIC: 'bic-2',
            IBAN: 'iban-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
      {
        userKeyId: 'cardFingerprint:card-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'CARD',
            cardFingerprint: 'card-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
      {
        userKeyId: 'cardFingerprint:card-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'CARD',
            cardFingerprint: 'card-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
      {
        userKeyId: 'walletId:wallet-1',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'WALLET',
            walletId: 'wallet-1',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
      {
        userKeyId: 'walletId:wallet-2',
        payload: {
          type: 'PRE_AGGREGATION',
          aggregationVariable: aggregationVariables[0],
          tenantId,
          paymentDetails: {
            method: 'WALLET',
            walletId: 'wallet-2',
          },
          currentTimestamp: expect.any(Number),
          entity: { type: 'RISK_FACTOR', riskFactorId },
          jobId: 'test-job-id',
        },
      },
    ]
    expect(sentTasks.length).toBe(expectedSentTasks.length)
    expect(sentTasks).toEqual(expect.arrayContaining(expectedSentTasks))
  })

  test('submits unique pre-aggregation tasks (user ID)', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'USER_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
      {
        key: 'agg:test-2',
        type: 'USER_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id-1',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await createJob(tenantId, testJob)
    await jobRunnerHandler(testJob)
    expect(
      ((await getJob(tenantId, testJob.jobId)) as RulePreAggregationBatchJob)
        .metadata?.tasksCount
    ).toBe(1)
  })

  test('submits unique pre-aggregation tasks (payment details)', async () => {
    const aggregationVariables: RuleAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'hour' },
          end: { units: 0, granularity: 'day' },
        },
      },
      {
        key: 'agg:test-2',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'hour' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const testJob: BatchJobWithId = {
      jobId: 'test-job-id-1',
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await createJob(tenantId, testJob)
    await jobRunnerHandler(testJob)
    expect(
      ((await getJob(tenantId, testJob.jobId)) as RulePreAggregationBatchJob)
        .metadata?.tasksCount
    ).toBe(2)
  })
})
