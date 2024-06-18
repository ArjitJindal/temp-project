import { v4 as uuidv4 } from 'uuid'
import { STARTS_WITH_OPERATOR } from '../../v8-operators/starts-ends-with'
import { createAggregationVariable } from '../test-utils'
import { AggregationRepository } from '../aggregation-repository'
import { TransactionRuleData } from '..'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { LegalDocument } from '@/@types/openapi-public/LegalDocument'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import dayjs from '@/utils/dayjs'

const operatorSpy = jest.spyOn(STARTS_WITH_OPERATOR, 'run')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RuleJsonLogicEvaluator, canAggregate } = require('..')
const bulkVerifyTransactions =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@/test-utils/rule-test-utils').bulkVerifyTransactions

dynamoDbSetupHook()

describe('Entity variable', () => {
  test('executes the json logic - hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        { direction: 'ORIGIN', value: { 'TRANSACTION:type': 'TRANSFER' } },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic - no hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'DEPOSIT' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'TRANSACTION:type': 'DEPOSIT' } }],
      hitDirections: [],
    })
  })

  test('executes the json logic - hit (user)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'CONSUMER_USER:userId__SENDER' }, 'abc'] }] },
      [],
      { tenantId },
      {
        type: 'USER',
        user: getTestUser({ userId: 'abc' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'CONSUMER_USER:userId__SENDER': 'abc' },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic - no hit (user)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'CONSUMER_USER:userId__SENDER' }, 'abc'] }] },
      [],
      { tenantId },
      {
        type: 'USER',
        user: getTestUser({ userId: 'cde' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'CONSUMER_USER:userId__SENDER': 'cde' },
        },
      ],
      hitDirections: [],
    })
  })
})
describe('Entity variable (array)', () => {
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
    const tenantId = 'tenant-id'
    const evaluator = new RuleJsonLogicEvaluator(tenantId, getDynamoDbClient())
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
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
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'TRANSACTION:tags': {
              key: ['1', 'a'],
              value: ['2', 'b'],
            },
          },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic - not hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
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
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
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
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction(),
        senderUser: getTestUser({
          legalDocuments: testLegalDocuments,
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'CONSUMER_USER:legalDocuments__SENDER': {
              'tags.key': ['1', 'a', '1', 'a'],
              'tags.value': ['b', '2', '2', 'b'],
            },
          },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic (nested) - not hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      TEST_LOGIC_NESTED,
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
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

describe('Aggregation variable', () => {
  test('executes the json logic (sending)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'RECEIVER',
          transactionDirection: 'RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (sending + receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
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
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
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
          userDirection: 'RECEIVER',
          transactionDirection: 'RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1, 'agg:456': 1 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic (sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER_OR_RECEIVER',
          transactionDirection: 'SENDING_RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
        {
          direction: 'DESTINATION',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic (sender-only; sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING_RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (receiver-only; sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'RECEIVER',
          transactionDirection: 'SENDING_RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (sender + receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'agg:123': 0 } }],
      hitDirections: [],
    })
  })

  test('executes the json logic (receiver + sending)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'RECEIVER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'agg:123': 0 } }],
      hitDirections: [],
    })
  })

  test('executes the json logic (filters logic)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
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
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultFilteredOut).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 0 },
        },
      ],
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
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultFiltered).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (time window)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
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
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultNotWithinTimeWindow).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 0 },
        },
      ],
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
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultWithinTimeWindow).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (object type aggregator)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '>': [{ var: 'agg:123' }, 100] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          baseCurrency: 'USD',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { units: 1, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'USD', tenantId },
      {
        type: 'TRANSACTION',
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
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 108.24283106705523 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('aggregation type (user ID)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const logic = { and: [{ '==': [{ var: 'agg:123' }, 1] }] }
    const aggVars = [
      {
        key: 'agg:123',
        type: 'USER_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const data: TransactionRuleData = {
      type: 'TRANSACTION',
      transaction: getTestTransaction({
        type: 'TRANSFER',
        originUserId: 'U-1',
        originPaymentDetails: undefined,
      }),
    }
    const result1 = await evaluator.evaluate(
      logic,
      aggVars,
      { baseCurrency: 'EUR', tenantId },
      data
    )
    expect(result1).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
    const result2 = await evaluator.evaluate(
      logic,
      aggVars,
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          ...data.transaction,
          originUserId: undefined,
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '1234',
          },
        }),
      }
    )
    expect(result2).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })
  test('aggregation type (payment ID)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const logic = { and: [{ '==': [{ var: 'agg:123' }, 1] }] }
    const aggVars = [
      {
        key: 'agg:123',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
      },
    ]
    const data: TransactionRuleData = {
      type: 'TRANSACTION',
      transaction: getTestTransaction({
        type: 'TRANSFER',
        originUserId: undefined,
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '1234',
        },
      }),
    }
    const result1 = await evaluator.evaluate(
      logic,
      aggVars,
      { baseCurrency: 'EUR', tenantId },
      data
    )
    expect(result1).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
    const result2 = await evaluator.evaluate(
      logic,
      aggVars,
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          ...data.transaction,
          originUserId: 'U-1',
          originPaymentDetails: undefined,
        }),
      }
    )
    expect(result2).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })
})

describe('Dataloder cache', () => {
  test('Testing the aggregation variable cache', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const loadAggregationDataSpy = jest.spyOn(
      evaluator as any,
      'loadAggregationData'
    )
    const testTransaction = getTestTransaction({ type: 'TRANSFER' })

    await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:124' }, 1] },
          { '==': [{ var: 'agg:125' }, 1] },
          { '==': [{ var: 'agg:126' }, 1] },
        ],
      },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:124',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:125',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:126',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          aggregationFunc: 'SUM',
          baseCurrency: 'EUR',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      { type: 'TRANSACTION', transaction: testTransaction }
    )
    await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:124' }, 1] },
          { '==': [{ var: 'agg:126' }, 1] },
        ],
      },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:124',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
        {
          key: 'agg:126',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          aggregationFunc: 'SUM',
          baseCurrency: 'EUR',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      { type: 'TRANSACTION', transaction: testTransaction }
    )
    /** Validating if the cache is called twice as we have two distinct aggregationFunc (COUNT & SUM) accross two evaluate calls */
    expect(loadAggregationDataSpy).toHaveBeenCalledTimes(2)
  })
})

describe('Different aggregate fields for receiving and sending', () => {
  test('testing different aggregationFieldKey based on direction', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 100] }] },
      [
        {
          key: 'agg:123',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER_OR_RECEIVER',
          transactionDirection: 'SENDING_RECEIVING',
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          secondaryAggregationFieldKey:
            'TRANSACTION:destinationAmountDetails-transactionAmount',
          aggregationFunc: 'SUM',
          timeWindow: {
            start: { units: 30, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
          baseCurrency: 'EUR',
        },
      ],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 100 },
        },
        {
          direction: 'DESTINATION',
          value: { 'agg:123': 100 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
})

describe('Test canAggregate function', () => {
  test('canAggregate function tests', () => {
    const variable1 = createAggregationVariable({
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
    })
    expect(canAggregate(variable1)).toBe(true)

    const variable2 = createAggregationVariable({
      timeWindow: {
        start: { units: 1, granularity: 'hour' },
        end: { units: 0, granularity: 'hour' },
      },
    })
    expect(canAggregate(variable2)).toBe(true)

    const variable3 = createAggregationVariable({
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable3)).toBe(true)

    const variable4 = createAggregationVariable({
      timeWindow: {
        start: { units: 20, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable4)).toBe(true)

    const variable5 = createAggregationVariable({
      timeWindow: {
        start: { units: 9, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable5)).toBe(false)

    const variable6 = createAggregationVariable({
      timeWindow: {
        start: { units: 15, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable6)).toBe(true)

    const variable7 = createAggregationVariable({
      timeWindow: {
        start: { units: 30, granularity: 'minute' },
        end: { units: 10, granularity: 'minute' },
      },
    })
    expect(canAggregate(variable7)).toBe(true)

    const variable8 = createAggregationVariable({
      timeWindow: {
        start: { units: 15, granularity: 'minute' },
        end: { units: 10, granularity: 'minute' },
      },
    })
    expect(canAggregate(variable8)).toBe(false)
  })
})

describe('operators', () => {
  beforeEach(() => {
    operatorSpy.mockRestore()
  })
  test('be called multiple times for different lhs/rhs values', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['b', ['b']] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(operatorSpy).toBeCalledTimes(2)
  })
  test('be called once for the same lhs/rhs values', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDbClient)
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      [],
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(operatorSpy).toBeCalledTimes(1)
  })
})

describe('V8 aggregator', () => {
  const getAggVar = (
    aggregationFieldKey: string,
    aggregationFunc: string,
    granularity: string
  ) => {
    return {
      aggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: {
          granularity: granularity,
          units: granularity === 'minute' ? 40 : 4,
        },
        end: { granularity: 'now', units: 0 },
      },
      userDirection: 'SENDER',
      type: 'USER_TRANSACTIONS',
      transactionDirection: 'SENDING',
      version: dayjs().valueOf(),
      key: `agg:${uuidv4()}`,
    } as RuleAggregationVariable
  }

  test('Should rebuild the aggregation data for the user for granularity day - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-03T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'day')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 300,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-03T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 400,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )

    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01', value: 1 },
      { time: '2023-01-02', value: 1 },
      { time: '2023-01-03', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity month - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-03-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'month'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-02-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-03-01T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData).toEqual([
      { time: '2023-01', value: 1 },
      { time: '2023-02', value: 1 },
      { time: '2023-03', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity year - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2025-01-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'year')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2024-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2025-01-01T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData).toEqual([
      { time: '2023', value: 1 },
      { time: '2024', value: 1 },
      { time: '2025', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity hour - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T14:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'hour')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T14:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12', value: 1 },
      { time: '2023-01-01-13', value: 1 },
      { time: '2023-01-01-14', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity minute - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T12:30:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'minute'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:05:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:25:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12-0', value: 2 },
      { time: '2023-01-01-12-2', value: 1 },
      { time: '2023-01-01-12-3', value: 1 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity day - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-02T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'day'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01', value: ['1'] },
      { time: '2023-01-02', value: ['1'] },
    ])
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserRuleTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData2).toEqual([{ time: '2023-01-02', value: ['2'] }])
  })
  test('Should rebuild the aggregation data for the user for granularity month - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-03-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'month'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-02-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData).toEqual([
      { time: '2023-01', value: ['1'] },
      { time: '2023-02', value: ['1'] },
    ])
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserRuleTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData2).toEqual([{ time: '2023-03', value: ['2'] }])
  })
  test('Should rebuild the aggregation data for the user for granularity year - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2025-01-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'year'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2024-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData).toEqual([
      { time: '2023', value: ['1'] },
      { time: '2024', value: ['1'] },
    ])
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserRuleTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData2).toEqual([{ time: '2025', value: ['2'] }])
  })

  test('Should rebuild the aggregation data for the user for granularity hour - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T14:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'hour'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12', value: ['1'] },
      { time: '2023-01-01-13', value: ['1'] },
    ])
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserRuleTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData2).toEqual([{ time: '2023-01-01-14', value: ['2'] }])
  })

  test('Should rebuild the aggregation data for the user for granularity minute - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new RuleJsonLogicEvaluator(
      tenantId,
      dynamoDb
    )
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T12:30:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'minute'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:12:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserRuleTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12-0', value: ['1'] },
      { time: '2023-01-01-12-1', value: ['1'] },
    ])
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserRuleTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData2).toEqual([{ time: '2023-01-01-12-3', value: ['2'] }])
  })
})
