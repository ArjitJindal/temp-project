import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import {
  BUSINESS_TYPE_RISK_FACTOR,
  CONSUMER_TYPE_RISK_FACTOR,
} from '../../user/customer-type'
import { getRiskFactorLogicByKeyAndType } from '../..'
import {
  TEST_BUSINESS_USER_RISK_PARAMETER,
  TEST_CONSUMER_USER_RISK_PARAMETER,
} from '@/test-utils/pulse-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'

dynamoDbSetupHook()
describe('Customer Type Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const consumerRiskFactor = TEST_CONSUMER_USER_RISK_PARAMETER
    const consumerV8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'CONSUMER_USER') ?? (() => [])
      )({
        riskLevelAssignmentValues:
          consumerRiskFactor.riskLevelAssignmentValues ?? [],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const consumerUser = { ...getTestUser(), type: 'CONSUMER' }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const consumerV8Result =
      await riskScoringV8Service.calculateRiskFactorScore(
        consumerV8RiskFactor,
        {
          user: consumerUser,
          type: 'USER',
        }
      )
    expect(50).toEqual(consumerV8Result.score)
  })
  test('V8 result should handle empty riskLevelAssignmentValues consumer user', async () => {
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'CONSUMER_USER') ?? (() => [])
      )({
        riskLevelAssignmentValues: [] as RiskParameterLevelKeyValue[],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user = { ...getTestUser(), type: 'CONSUMER' }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(90).toEqual(v8Result.score)
  })
  test('V8 result should be able handel empty type consumer user', async () => {
    const riskFactor = TEST_CONSUMER_USER_RISK_PARAMETER

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'CONSUMER_USER') ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues ?? [],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user = { ...getTestUser(), type: '' }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(50).toEqual(v8Result.score)
  })
  test('V8 result should be able handel null consumer user', async () => {
    const riskFactor = TEST_CONSUMER_USER_RISK_PARAMETER
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'CONSUMER_USER') ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues ?? [],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user = { ...getTestUser(), type: null }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(50).toEqual(v8Result.score)
  })
  test('Basic case # 2', async () => {
    const businessRiskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'REGISTERED',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_SCORE',
            value: 90,
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const businessV8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'BUSINESS') ?? (() => [])
      )({
        riskLevelAssignmentValues: businessRiskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const businessUser = { ...getTestBusiness(), type: 'BUSINESS' }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const businessV8Result =
      await riskScoringV8Service.calculateRiskFactorScore(
        businessV8RiskFactor,
        {
          user: businessUser,
          type: 'USER',
        }
      )
    expect(90).toEqual(businessV8Result.score)
  })
  test('V8 result should be able handel empty type business user', async () => {
    const riskFactor = TEST_BUSINESS_USER_RISK_PARAMETER

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'BUSINESS') ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues ?? [],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const businessUser = { ...getTestBusiness(), type: '' }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user: businessUser,
        type: 'USER',
      }
    )
    expect(90).toEqual(v8Result.score)
  })
  test('V8 result should be able handel null business user', async () => {
    const riskFactor = TEST_BUSINESS_USER_RISK_PARAMETER
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('type', 'BUSINESS') ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues ?? [],
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const businessUser = { ...getTestBusiness(), type: null }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user: businessUser,
        type: 'USER',
      }
    )
    expect(90).toEqual(v8Result.score)
  })
})
