import { RuleJsonLogicEvaluator } from '..'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

test('executes the json logic - hit', async () => {
  const evaluator = new RuleJsonLogicEvaluator('tenant-id', getDynamoDbClient())
  const result = await evaluator.evaluate(
    { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
    [],
    { transaction: getTestTransaction({ type: 'TRANSFER' }) }
  )
  expect(result).toEqual({
    hit: true,
    varData: { 'TRANSACTION:type': 'TRANSFER' },
  })
})

test('executes the json logic - no hit', async () => {
  const evaluator = new RuleJsonLogicEvaluator('tenant-id', getDynamoDbClient())
  const result = await evaluator.evaluate(
    { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
    [],
    { transaction: getTestTransaction({ type: 'DEPOSIT' }) }
  )
  expect(result).toEqual({
    hit: false,
    varData: { 'TRANSACTION:type': 'DEPOSIT' },
  })
})

describe('aggregation', () => {
  test('executes the json logic', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          direction: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:id',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
    })
  })

  test('executes the json logic (filters logic)', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      direction: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:id',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
    } as const
    const resultFilteredOut = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          ...testAggVar,
          filtersLogic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
          },
        },
      ],
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultFilteredOut).toEqual({
      hit: false,
      varData: { 'agg:123': 0 },
    })
    const resultFiltered = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          ...testAggVar,
          filtersLogic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }],
          },
        },
      ],
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultFiltered).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
    })
  })

  test('executes the json logic (time window)', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      direction: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:id',
      aggregationFunc: 'COUNT',
    } as const
    const resultNotWithinTimeWindow = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          ...testAggVar,
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 1, granularity: 'day' },
          },
        },
      ],
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultNotWithinTimeWindow).toEqual({
      hit: false,
      varData: { 'agg:123': 0 },
    })
    const resultWithinTimeWindow = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          ...testAggVar,
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultWithinTimeWindow).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
    })
  })
})
