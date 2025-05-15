import { ruleHandler, ruleInstanceHandler } from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getApiGatewayDeleteEvent,
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

dynamoDbSetupHook()

describe('Public Management API - Rule', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const TEST_RULE_INSTANCE_ID = 'TEST_RULE_INSTANCE_ID'
  let ruleRepository: RuleRepository
  let ruleInstanceRepository: RuleInstanceRepository

  beforeAll(async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    ruleRepository = new RuleRepository(TEST_TENANT_ID, { dynamoDb, mongoDb })
    ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    await ruleRepository.createOrUpdateRule(RULES_LIBRARY[0])
    await ruleRepository.createOrUpdateRule(RULES_LIBRARY[1])
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      id: TEST_RULE_INSTANCE_ID,
      ruleId: 'R-1',
      parameters: {},
      checksFor: ['Transaction amount'],
      ruleNameAlias: 'Foo bar',
      riskLevelParameters: {
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
        VERY_LOW: {},
      },
      action: 'BLOCK',
      riskLevelActions: {
        VERY_HIGH: 'ALLOW',
        HIGH: 'ALLOW',
        MEDIUM: 'ALLOW',
        LOW: 'ALLOW',
        VERY_LOW: 'ALLOW',
      },
      status: 'ACTIVE',
      casePriority: 'P1',
      type: 'TRANSACTION',
      nature: 'AML',
      labels: [],
    })
  })

  test('Rules - List', async () => {
    const response = await ruleHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/rules'),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toMatchObject([
      {
        id: 'R-1',
        type: 'TRANSACTION',
        name: 'First transaction of a user',
        description: 'First transaction of a user',
        parametersSchema: {
          type: 'object',
          properties: {
            transactionAmountThreshold: {
              additionalProperties: {
                type: 'number',
              },
              type: 'object',
              'ui:schema': { 'ui:subtype': 'TRANSACTION_AMOUNT_THRESHOLDS' },
              title: 'Transactions amount threshold',
              nullable: true,
              required: [],
            },
          },
          required: [],
        },
        defaultParameters: {},
        defaultAction: 'FLAG',
        labels: [],
        defaultCasePriority: 'P1',
        defaultNature: 'AML',
      },
      {
        id: 'R-2',
        type: 'TRANSACTION',
        name: 'Transaction amount too high',
        description: 'Transaction amount is >= x in USD or equivalent',
        parametersSchema: {
          type: 'object',
          properties: {
            transactionAmountThreshold: {
              additionalProperties: {
                type: 'number',
              },
              type: 'object',
              'ui:schema': { 'ui:subtype': 'TRANSACTION_AMOUNT_THRESHOLDS' },
              title: 'Transactions amount threshold',
              required: [],
            },
          },
          required: ['transactionAmountThreshold'],
        },
        defaultParameters: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        },
        defaultAction: 'SUSPEND',
        labels: [],
        defaultCasePriority: 'P1',
        defaultNature: 'AML',
      },
    ])
  })

  test('Rule Filters Schema- Get', async () => {
    const response = await ruleHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/rule-filters-schema'),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(200)
    const returnedSchema = JSON.parse(response.body)
    expect(returnedSchema.type).toEqual('object')
    expect(returnedSchema.properties).toMatchObject({
      originPaymentFilters: {
        description:
          'Filters origin payment methods, wallet types, card issued countries and payment channels inside the payment details on which the rule will be applied',
        properties: {
          paymentMethods: {
            type: 'array',
            'ui:schema': {
              'ui:subtype': 'PAYMENT_METHOD',
            },
            title: 'Payment methods',
            items: {
              enum: [
                'ACH',
                'CARD',
                'IBAN',
                'UPI',
                'GENERIC_BANK_ACCOUNT',
                'MPESA',
                'SWIFT',
                'WALLET',
                'CHECK',
                'CASH',
                'NPP',
              ],
            },
            nullable: true,
          },
        },
        nullable: true,
      },
    })
  })

  test('Rules - Get', async () => {
    const response = await ruleHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/rules/{ruleId}', {
        pathParameters: {
          ruleId: 'R-1',
        },
      }),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toMatchObject({
      id: 'R-1',
      type: 'TRANSACTION',
      name: 'First transaction of a user',
      description: 'First transaction of a user',
      parametersSchema: {
        type: 'object',
        properties: {
          transactionAmountThreshold: {
            additionalProperties: {
              type: 'number',
            },
            type: 'object',
            title: 'Transactions amount threshold',
            nullable: true,
            required: [],
          },
        },
        required: [],
      },
      defaultParameters: {},
      defaultAction: 'FLAG',
      labels: [],
      defaultCasePriority: 'P1',
      defaultNature: 'AML',
    })
  })

  test('Rule Instances - List', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/rule-instances'),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    const ruleInstance = JSON.parse(response.body)
    expect(ruleInstance).toHaveLength(1)
    expect(ruleInstance[0]).toEqual({
      id: 'TEST_RULE_INSTANCE_ID',
      type: 'TRANSACTION',
      ruleId: 'R-1',
      ruleNameAlias: 'Foo bar',
      parameters: {},
      riskLevelParameters: {
        VERY_LOW: {},
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
      },
      checksFor: ['Transaction amount'],
      action: 'BLOCK',
      riskLevelActions: {
        VERY_LOW: 'ALLOW',
        VERY_HIGH: 'ALLOW',
        HIGH: 'ALLOW',
        MEDIUM: 'ALLOW',
        LOW: 'ALLOW',
      },
      status: 'ACTIVE',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      runCount: 0,
      hitCount: 0,
      casePriority: 'P1',
      nature: 'AML',
      labels: [],
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
    })
  })

  test('Rule Instances - Create', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/rule-instances', {
        ruleId: 'R-1',
        ruleNameAlias: 'Foo bar - new',
        parameters: {},
        action: 'SUSPEND',
        status: 'ACTIVE',
      }),
      null as any,
      null as any
    )
    const ruleInstanceResponse = JSON.parse(response.body)
    expect(ruleInstanceResponse).toEqual({
      id: expect.any(String),
      type: 'TRANSACTION',
      ruleId: 'R-1',
      ruleNameAlias: 'Foo bar - new',
      parameters: {},
      action: 'SUSPEND',
      status: 'ACTIVE',
      casePriority: 'P1',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      runCount: 0,
      hitCount: 0,
      checksFor: ['1st transaction'],
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      nature: 'AML',
      labels: [],
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      ruleInstanceResponse.id
    )
    expect(ruleInstance).toEqual(ruleInstanceResponse)
  })

  test('Rule Instances - Create (invalid parameters)', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/rule-instances', {
        id: 'NEW_RULE_INSTANCE_ID_2',
        type: 'TRANSACTION',
        ruleId: 'R-2',
        ruleNameAlias: 'Foo bar - new',
        parameters: {},
        action: 'SUSPEND',
        status: 'ACTIVE',
        casePriority: 'P1',
        nature: 'AML',
      }),
      null as any,
      null as any
    )
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toMatchObject({
      error: 'BadRequestError',
      message:
        "Invalid parameters: must have required property 'transactionAmountThreshold'",
    })
  })

  test('Rule Instances - Update', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/rule-instances/{ruleInstanceId}',
        {
          ruleNameAlias: 'Bar foo',
        },
        {
          pathParameters: {
            ruleInstanceId: TEST_RULE_INSTANCE_ID,
          },
        }
      ),
      null as any,
      null as any
    )
    expect(response.statusCode).toBe(200)
    const ruleInstanceResponse = JSON.parse(response.body)
    expect(ruleInstanceResponse).toEqual({
      id: TEST_RULE_INSTANCE_ID,
      ruleId: 'R-1',
      parameters: {},
      ruleNameAlias: 'Bar foo',
      riskLevelParameters: {
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
        VERY_LOW: {},
      },
      action: 'BLOCK',
      riskLevelActions: {
        VERY_HIGH: 'ALLOW',
        HIGH: 'ALLOW',
        MEDIUM: 'ALLOW',
        LOW: 'ALLOW',
        VERY_LOW: 'ALLOW',
      },
      status: 'ACTIVE',
      casePriority: 'P1',
      type: 'TRANSACTION',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      runCount: 0,
      hitCount: 0,
      nature: 'AML',
      labels: [],
      checksFor: ['Transaction amount'],
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      TEST_RULE_INSTANCE_ID
    )
    expect(ruleInstance).toEqual(ruleInstanceResponse)
  })

  test('Rule Instances - Delete', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayDeleteEvent(
        TEST_TENANT_ID,
        '/rule-instances/{ruleInstanceId}',
        {
          pathParameters: {
            ruleInstanceId: TEST_RULE_INSTANCE_ID,
          },
        }
      ),
      null as any,
      null as any
    )
    expect(response).toMatchObject({
      statusCode: 200,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      TEST_RULE_INSTANCE_ID
    )
    expect(ruleInstance).toBeNull()
  })

  test('Rule Instances - Delete (non-existent ID)', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayDeleteEvent(
        TEST_TENANT_ID,
        '/rule-instances/{ruleInstanceId}',
        {
          pathParameters: {
            ruleInstanceId: 'ghost-id',
          },
        }
      ),
      null as any,
      null as any
    )
    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toMatchObject({
      error: 'NotFoundError',
      message: 'Rule instance ghost-id not found',
    })
  })
})
