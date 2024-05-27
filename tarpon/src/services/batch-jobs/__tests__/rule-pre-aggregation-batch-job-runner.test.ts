import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { BatchJobWithId } from '@/@types/batch-job'
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

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V8'])
withLocalChangeHandler()

const dynamoDb = getDynamoDbClient()

const sendAggregationTaskMock = jest.spyOn(v8Engine, 'sendAggregationTask')
sendAggregationTaskMock.mockImplementation(() => Promise.resolve())

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

describe('Rule pre-aggregation job runner', () => {
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
        ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
        ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
        ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
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
        ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
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
          ruleInstanceId: ruleInstanceId,
          jobId: 'test-job-id',
        },
      },
    ]
    expect(sentTasks.length).toBe(expectedSentTasks.length)
    expect(sentTasks).toEqual(expect.arrayContaining(expectedSentTasks))
  })
})
