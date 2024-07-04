import { renameV8KeyForTenant, replaceMagicKeywordInLogic } from '../rule'
import { createRule } from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

const TEST_TENANT_ID = getTestTenantId()
dynamoDbSetupHook()

describe('testing v8 key migration', () => {
  let cleanup: () => Promise<void>
  beforeEach(async () => {
    cleanup = await createRule(
      TEST_TENANT_ID,
      {
        defaultLogic: {
          and: [
            {
              '>': [
                { var: 'TRANSACTION:originPaymentDetails-transactionAmount' },
                2000,
              ],
            },
            {
              'test-operator': [
                {
                  var: 'agg:123',
                },
                2,
              ],
            },
            {
              '==': [
                {
                  'test-function': [{ var: 'agg:123' }],
                },
                'asv',
              ],
            },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            aggregationFieldKey:
              'TRANSACTION:originPaymentDetails-transactionAmount',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 1, granularity: 'month' },
              end: { units: 0, granularity: 'month' },
            },
          },
        ],
      },
      { ruleInstanceId: 'test-rule-instance', ruleId: 'RC-123' }
    )
  })

  afterEach(async () => {
    await cleanup()
  })

  test('rename variable key', async () => {
    await renameV8KeyForTenant(
      'TRANSACTION:originPaymentDetails-transactionAmount',
      'test-change-name',
      'var',
      TEST_TENANT_ID
    )
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      'test-rule-instance'
    )
    expect(ruleInstance?.logic).toEqual({
      and: [
        {
          '>': [{ var: 'test-change-name' }, 2000],
        },
        {
          'test-operator': [
            {
              var: 'agg:123',
            },
            2,
          ],
        },
        {
          '==': [
            {
              'test-function': [{ var: 'agg:123' }],
            },
            'asv',
          ],
        },
      ],
    })
    expect(
      ruleInstance?.logicAggregationVariables?.[0].aggregationFieldKey
    ).toEqual('test-change-name')
  })

  test('rename operator key', async () => {
    await renameV8KeyForTenant(
      'test-operator',
      'test-change-name',
      'op',
      TEST_TENANT_ID
    )
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      'test-rule-instance'
    )
    expect(ruleInstance?.logic).toEqual({
      and: [
        {
          '>': [
            { var: 'TRANSACTION:originPaymentDetails-transactionAmount' },
            2000,
          ],
        },
        {
          'test-change-name': [
            {
              var: 'agg:123',
            },
            2,
          ],
        },
        {
          '==': [
            {
              'test-function': [{ var: 'agg:123' }],
            },
            'asv',
          ],
        },
      ],
    })
  })

  test('rename function key', async () => {
    await renameV8KeyForTenant(
      'test-function',
      'test-change-name',
      'func',
      TEST_TENANT_ID
    )
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      'test-rule-instance'
    )
    expect(ruleInstance?.logic).toEqual({
      and: [
        {
          '>': [
            { var: 'TRANSACTION:originPaymentDetails-transactionAmount' },
            2000,
          ],
        },
        {
          'test-operator': [
            {
              var: 'agg:123',
            },
            2,
          ],
        },
        {
          '==': [
            {
              'test-change-name': [{ var: 'agg:123' }],
            },
            'asv',
          ],
        },
      ],
    })
  })
})

describe('replaceMagicKeywordInLogic function', () => {
  it('should replace keyword in object values when type is "var" and not a key', () => {
    const input = {
      key1: 'replaceMe',
      key2: 'dontReplaceMe',
      key3: { replaceMe: 'replaceMe' },
    }
    const keyword = 'replaceMe'
    const replacement = 'replaced'
    const type = 'var'

    const result = replaceMagicKeywordInLogic(keyword, replacement, input, type)

    expect(result).toEqual({
      key1: 'replaced',
      key2: 'dontReplaceMe',
      key3: { replaceMe: 'replaced' },
    })
  })

  it('should replace keyword in object keys when type is "func" or "op"', () => {
    const input = { replaceMe: 'value1', dontReplaceMe: 'value2' }
    const keyword = 'replaceMe'
    const replacement = 'replaced'
    const type = 'func'

    const result = replaceMagicKeywordInLogic(keyword, replacement, input, type)

    expect(result).toEqual({ replaced: 'value1', dontReplaceMe: 'value2' })
  })

  it('should replace keyword in nested objects', () => {
    const input = { key1: { key2: 'replaceMe' } }
    const keyword = 'replaceMe'
    const replacement = 'replaced'
    const type = 'var'

    const result = replaceMagicKeywordInLogic(keyword, replacement, input, type)

    expect(result).toEqual({ key1: { key2: 'replaced' } })
  })
})
