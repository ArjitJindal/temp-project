import { groupBy, map, sortBy } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { SQSClient } from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
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
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestRuleInstance } from '@/test-utils/rule-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getTestRiskFactor } from '@/test-utils/pulse-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import * as snsSqsClient from '@/utils/sns-sqs-client'
import { TIME_SLICE_COUNT } from '@/services/logic-evaluator/engine/aggregation-repository'
import { generateChecksum } from '@/utils/object'
import { BatchJobTable } from '@/models/batch-job'
import { setupClickHouseForTest } from '@/test-utils/clickhouse-test-utils'

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V8', 'RISK_SCORING'])
withLocalChangeHandler()

const dynamoDb = getDynamoDbClient()

const bulkSendMessagesMock = jest.spyOn(snsSqsClient, 'bulkSendMessages')

async function setUpAggregationVariables(
  tenantId: string,
  aggregationVariables: LogicAggregationVariable[]
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
  aggregationVariables: LogicAggregationVariable[]
): Promise<{ riskFactorId: string }> {
  const riskRepository = new RiskRepository(tenantId, {
    dynamoDb,
  })
  const riskFactor = getTestRiskFactor({
    logicAggregationVariables: aggregationVariables,
    id: 'risk-factor-id',
  })
  await riskRepository.createOrUpdateRiskFactor(riskFactor)

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

  beforeEach(async () => {
    await setupClickHouseForTest(tenantId, [
      BatchJobTable.tableDefinition.tableName,
    ])

    bulkSendMessagesMock.mockClear()
    mockClient(SQSClient)
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
    const aggregationVariables: LogicAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'USER_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day', rollingBasis: true },
          end: { units: 0, granularity: 'day', rollingBasis: true },
        },
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )
    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
        currentTimestamp: now.valueOf(),
      },
    }
    await jobRunnerHandler(testJob)
    const messages = bulkSendMessagesMock.mock.calls[0][2].map((v) =>
      JSON.parse(v.MessageBody as string)
    )
    const timeRanges = messages
      .map((message) => message.timeWindow)
      .sort((a, b) => a.startTimestamp - b.startTimestamp)
    expect(timeRanges[0].startTimestamp).toEqual(
      dayjs(now.valueOf()).subtract(1, 'day').valueOf()
    )
    expect(timeRanges[timeRanges.length - 1].endTimestamp).toEqual(
      now.valueOf()
    )
    expect(messages.length).toEqual(TIME_SLICE_COUNT)
    expect(messages[0]).toEqual({
      type: 'PRE_AGGREGATION',
      totalSliceCount: 5,
      aggregationVariable: aggregationVariables[0],
      tenantId,
      userId: 'U-1',
      currentTimestamp: expect.any(Number),
      timeWindow: expect.any(Object),
      jobId,
      entity: {
        type: 'RULE',
        ruleInstanceId,
      },
    })
  })

  test('submits pre-aggregation tasks for the users in the target time range and direction - 2', async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const messages = sortBy(
      map(
        groupBy(
          bulkSendMessagesMock.mock.calls[0][2].map((v) =>
            JSON.parse(v.MessageBody as string)
          ),
          'userId'
        ),
        (group) => group[0]
      ),
      'userId'
    )
    expect(messages).toEqual([
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        userId: 'U-1',
        currentTimestamp: expect.any(Number),
        jobId,
        entity: {
          type: 'RULE',
          ruleInstanceId,
        },
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        userId: 'U-2',
        currentTimestamp: expect.any(Number),
        jobId,
        entity: {
          type: 'RULE',
          ruleInstanceId,
        },
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        userId: 'U-3',
        currentTimestamp: expect.any(Number),
        jobId,
        entity: {
          type: 'RULE',
          ruleInstanceId,
        },
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        userId: 'U-4',
        currentTimestamp: expect.any(Number),
        jobId,
        entity: {
          type: 'RULE',
          ruleInstanceId,
        },
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
    ])
  })

  test('submits pre-aggregation tasks for the payment details in the target time range and direction - 1', async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
      {
        key: 'agg:test',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 1, granularity: 'day', rollingBasis: true },
          end: { units: 0, granularity: 'day', rollingBasis: true },
        },
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
        currentTimestamp: now.valueOf(),
      },
    }
    await jobRunnerHandler(testJob)
    const messages = bulkSendMessagesMock.mock.calls[0][2].map((v) =>
      JSON.parse(v.MessageBody as string)
    )
    const timeRanges = messages
      .map((message) => message.timeWindow)
      .sort((a, b) => a.startTimestamp - b.startTimestamp)
    expect(timeRanges[0].startTimestamp).toEqual(
      dayjs(now.valueOf()).subtract(1, 'day').valueOf()
    )
    expect(timeRanges[timeRanges.length - 1].endTimestamp).toEqual(
      now.valueOf()
    )
    expect(messages.length).toEqual(TIME_SLICE_COUNT)
    expect(messages[0]).toEqual({
      type: 'PRE_AGGREGATION',
      aggregationVariable: aggregationVariables[0],
      tenantId,
      paymentDetails: { method: 'IBAN', BIC: 'bic-1', IBAN: 'iban-1' },
      currentTimestamp: expect.any(Number),
      timeWindow: expect.any(Object),
      jobId,
      totalSliceCount: 5,
      entity: {
        type: 'RULE',
        ruleInstanceId,
      },
    })
  })

  test('submits pre-aggregation tasks for the payment details in the target time range and direction - 2', async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const messages = sortBy(
      map(
        groupBy(
          bulkSendMessagesMock.mock.calls[0][2].map((v) =>
            JSON.parse(v.MessageBody as string)
          ),
          (val) => generateChecksum(val.paymentDetails)
        ),
        (group) => group[0]
      ),
      'paymentDetails.method'
    )
    expect(messages).toEqual([
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'CARD',
          cardFingerprint: 'card-1',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RULE', ruleInstanceId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'CARD',
          cardFingerprint: 'card-2',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RULE', ruleInstanceId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
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
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
        jobId,
      },
      {
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
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'WALLET',
          walletId: 'wallet-1',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RULE', ruleInstanceId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'WALLET',
          walletId: 'wallet-2',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RULE', ruleInstanceId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
    ])
  })

  test('submits pre-aggregation tasks for the users in the target time range and direction - 1 (risk factor)', async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
      },
    ]
    const { riskFactorId } = await setUpAggregationVariablesRiskFactors(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RISK_FACTOR', riskFactorId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    const messages = sortBy(
      map(
        groupBy(
          bulkSendMessagesMock.mock.calls[0][2].map((v) =>
            JSON.parse(v.MessageBody as string)
          ),
          (val) => generateChecksum(val.paymentDetails)
        ),
        (group) => group[0]
      ),
      'paymentDetails.method'
    )
    expect(messages).toEqual([
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'CARD',
          cardFingerprint: 'card-1',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RISK_FACTOR', riskFactorId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'CARD',
          cardFingerprint: 'card-2',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RISK_FACTOR', riskFactorId },
        jobId,
        totalSliceCount: 2,
        timeWindow: expect.any(Object),
      },
      {
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
        jobId,
        totalSliceCount: 2,
        timeWindow: expect.any(Object),
      },
      {
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
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'WALLET',
          walletId: 'wallet-1',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RISK_FACTOR', riskFactorId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
      {
        type: 'PRE_AGGREGATION',
        aggregationVariable: aggregationVariables[0],
        tenantId,
        paymentDetails: {
          method: 'WALLET',
          walletId: 'wallet-2',
        },
        currentTimestamp: expect.any(Number),
        entity: { type: 'RISK_FACTOR', riskFactorId },
        jobId,
        timeWindow: expect.any(Object),
        totalSliceCount: 2,
      },
    ])
  })

  test('submits unique pre-aggregation tasks (user ID)', async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
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
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
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
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
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
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
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
    ).toBe(2 * TIME_SLICE_COUNT)
  })

  test("doesn't submit pre-aggregation tasks if already submitted before", async () => {
    const aggregationVariables: LogicAggregationVariable[] = [
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
        includeCurrentEntity: true,
      },
    ]
    const { ruleInstanceId } = await setUpAggregationVariables(
      tenantId,
      aggregationVariables
    )

    const jobId = uuidv4()
    const testJob: BatchJobWithId = {
      jobId,
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: { type: 'RULE', ruleInstanceId },
        aggregationVariables,
      },
    }
    await jobRunnerHandler(testJob)
    expect(bulkSendMessagesMock.mock.calls[0][2]).toHaveLength(1)
    await jobRunnerHandler(testJob)
    expect(bulkSendMessagesMock.mock.calls[1][2]).toHaveLength(0)
  })
})
