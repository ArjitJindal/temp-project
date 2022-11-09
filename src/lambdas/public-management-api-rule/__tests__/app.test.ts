import { ruleHandler, ruleInstanceHandler } from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getApiGatewayDeleteEvent,
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { TRANSACTION_RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

dynamoDbSetupHook()

describe('Public Management API - Rule', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const TEST_RULE_INSTANCE_ID = 'TEST_RULE_INSTANCE_ID'
  let ruleRepository: RuleRepository
  let ruleInstanceRepository: RuleInstanceRepository

  beforeAll(async () => {
    const dynamoDb = getDynamoDbClient()
    ruleRepository = new RuleRepository(TEST_TENANT_ID, { dynamoDb })
    ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    await ruleRepository.createOrUpdateRule(TRANSACTION_RULES_LIBRARY[0])
    await ruleRepository.createOrUpdateRule(TRANSACTION_RULES_LIBRARY[1])
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      id: TEST_RULE_INSTANCE_ID,
      ruleId: 'R-1',
      parameters: {},
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
      caseCreationType: 'USER',
      casePriority: 'P1',
      type: 'TRANSACTION',
    })
  })

  test('Rules - List', async () => {
    const response = await ruleHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/rules'),
      null as any,
      null as any
    )
    expect(response).toMatchObject({
      statusCode: 200,
      body: JSON.stringify([
        {
          id: 'R-1',
          type: 'TRANSACTION',
          name: 'First payment of a Customer',
          description: 'First transaction of a user',
          parametersSchema: {
            type: 'object',
            properties: {
              transactionAmountThreshold: {
                additionalProperties: {
                  type: 'integer',
                },
                type: 'object',
                title: 'Transactions Amount Threshold',
                nullable: true,
                required: [],
              },
            },
            required: [],
          },
          defaultParameters: {},
          defaultAction: 'FLAG',
          labels: ['AML'],
          defaultCaseCreationType: 'TRANSACTION',
          defaultCasePriority: 'P1',
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
                  type: 'integer',
                },
                type: 'object',
                title: 'Transactions Amount Threshold',
                required: [],
              },
              paymentChannel: {
                type: 'string',
                title: 'Payment Channel',
                nullable: true,
                enum: ['GOOGLE_PAY', 'APPLE_PAY', 'ATM', 'SAMSUNG_PAY'],
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
          labels: ['AML', 'Fraud'],
          defaultCaseCreationType: 'TRANSACTION',
          defaultCasePriority: 'P1',
        },
      ]),
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
    expect(response).toMatchObject({
      statusCode: 200,
      body: JSON.stringify({
        id: 'R-1',
        type: 'TRANSACTION',
        name: 'First payment of a Customer',
        description: 'First transaction of a user',
        parametersSchema: {
          type: 'object',
          properties: {
            transactionAmountThreshold: {
              additionalProperties: {
                type: 'integer',
              },
              type: 'object',
              title: 'Transactions Amount Threshold',
              nullable: true,
              required: [],
            },
          },
          required: [],
        },
        defaultParameters: {},
        defaultAction: 'FLAG',
        labels: ['AML'],
        defaultCaseCreationType: 'TRANSACTION',
        defaultCasePriority: 'P1',
      }),
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
      caseCreationType: 'USER',
    })
  })

  test('Rule Instances - Create', async () => {
    const response: any = await ruleInstanceHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/rule-instances', {
        id: 'NEW_RULE_INSTANCE_ID',
        type: 'TRANSACTION',
        ruleId: 'R-1',
        ruleNameAlias: 'Foo bar - new',
        parameters: {},
        action: 'SUSPEND',
        status: 'ACTIVE',
        casePriority: 'P1',
        caseCreationType: 'USER',
      }),
      null as any,
      null as any
    )
    const ruleInstanceResponse = JSON.parse(response.body)
    expect(ruleInstanceResponse).toEqual({
      id: 'NEW_RULE_INSTANCE_ID',
      type: 'TRANSACTION',
      ruleId: 'R-1',
      ruleNameAlias: 'Foo bar - new',
      parameters: {},
      action: 'SUSPEND',
      status: 'ACTIVE',
      casePriority: 'P1',
      caseCreationType: 'USER',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      runCount: 0,
      hitCount: 0,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      'NEW_RULE_INSTANCE_ID'
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
        caseCreationType: 'USER',
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
      caseCreationType: 'USER',
      casePriority: 'P1',
      type: 'TRANSACTION',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      runCount: 0,
      hitCount: 0,
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
      body: JSON.stringify('OK'),
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
