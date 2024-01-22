import { RuleJsonLogicEvaluator } from '..'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { LegalDocument } from '@/@types/openapi-public/LegalDocument'

dynamoDbSetupHook()

describe('entity variable', () => {
  test('executes the json logic - hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
      [],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'TRANSACTION:type': 'TRANSFER' },
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic - no hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
      [],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'DEPOSIT' }) }
    )
    expect(result).toEqual({
      hit: false,
      varData: { 'TRANSACTION:type': 'DEPOSIT' },
      hitDirections: [],
    })
  })
})
describe('entity variable (array)', () => {
  const TEST_LOGIC = {
    and: [
      {
        some: [
          { var: 'TRANSACTION:tags' },
          {
            and: [
              { '==': [{ var: 'key' }, 'a'] },
              { '==': [{ var: 'value' }, 'b'] },
            ],
          },
        ],
      },
    ],
  }
  const TEST_LOGIC_NESTED = {
    and: [
      {
        some: [
          { var: 'CONSUMER_USER:legalDocuments__SENDER' },
          {
            some: [
              { var: 'tags' },
              {
                and: [
                  { '==': [{ var: 'key' }, 'a'] },
                  { '==': [{ var: 'value' }, 'b'] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  test('executes the json logic - hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      [],
      { baseCurrency: 'EUR' },
      {
        transaction: getTestTransaction({
          tags: [
            { key: '1', value: '2' },
            { key: 'a', value: 'b' },
          ],
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      varData: {
        'TRANSACTION:tags': [
          { key: '1', value: '2' },
          { key: 'a', value: 'b' },
        ],
      },
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic - not hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      [],
      { baseCurrency: 'EUR' },
      {
        transaction: getTestTransaction({
          tags: [
            { key: '1', value: 'b' },
            { key: 'a', value: '2' },
          ],
        }),
      }
    )
    expect(result).toMatchObject({ hit: false })
  })
  test('executes the json logic (nested) - hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const testLegalDocuments: LegalDocument[] = [
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedCountry: 'DE',
        tags: [
          { key: '1', value: 'b' },
          { key: 'a', value: '2' },
        ],
      },
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedCountry: 'DE',
        tags: [
          { key: '1', value: '2' },
          { key: 'a', value: 'b' },
        ],
      },
    ]
    const result = await evaluator.evaluate(
      TEST_LOGIC_NESTED,
      [],
      { baseCurrency: 'EUR' },
      {
        transaction: getTestTransaction(),
        senderUser: getTestUser({
          legalDocuments: testLegalDocuments,
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      varData: {
        'CONSUMER_USER:legalDocuments__SENDER': testLegalDocuments,
      },
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic (nested) - not hit', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      TEST_LOGIC_NESTED,
      [],
      { baseCurrency: 'EUR' },
      {
        transaction: getTestTransaction(),
        senderUser: getTestUser({
          legalDocuments: [
            {
              documentType: 'passport',
              documentNumber: 'Z9431P',
              documentIssuedCountry: 'DE',
              tags: [
                { key: '1', value: 'b' },
                { key: 'a', value: '2' },
              ],
            },
          ],
        }),
      }
    )
    expect(result).toMatchObject({ hit: false })
  })
})

describe('aggregation variable', () => {
  test('executes the json logic (sending)', async () => {
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
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (receiving)', async () => {
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
          direction: 'RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (sending + receiving)', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:456' }, 1] },
        ],
      },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          direction: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:456',
          type: 'USER_TRANSACTIONS',
          direction: 'RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 1, 'agg:456': 1 },
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic (sending_receiving)', async () => {
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
          direction: 'SENDING_RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
      hitDirections: ['ORIGIN', 'DESTINATION'],
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
      direction: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
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
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultFilteredOut).toEqual({
      hit: false,
      varData: { 'agg:123': 0 },
      hitDirections: [],
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
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultFiltered).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
      hitDirections: ['DESTINATION'],
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
      aggregationFieldKey: 'TRANSACTION:transactionId',
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
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultNotWithinTimeWindow).toEqual({
      hit: false,
      varData: { 'agg:123': 0 },
      hitDirections: [],
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
      { baseCurrency: 'EUR' },
      { transaction: getTestTransaction({ type: 'TRANSFER' }) }
    )
    expect(resultWithinTimeWindow).toEqual({
      hit: true,
      varData: { 'agg:123': 1 },
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (object type aggregator)', async () => {
    const evaluator = new RuleJsonLogicEvaluator(
      'tenant-id',
      getDynamoDbClient()
    )
    const result = await evaluator.evaluate(
      { and: [{ '>': [{ var: 'agg:123' }, 100] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          direction: 'SENDING',
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { units: 1, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'USD' },
      {
        transaction: getTestTransaction({
          type: 'TRANSFER',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      varData: { 'agg:123': 106.85660242529653 },
      hitDirections: ['ORIGIN'],
    })
  })
})
