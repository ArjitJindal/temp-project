import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { getRiskFactorLogicByKeyAndType } from '../..'
import { CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR } from '../../user/source-of-funds'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/constants/risk/classification'
import { TEST_ITERABLE_RISK_ITEM } from '@/test-utils/pulse-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { SourceOfFunds } from '@/@types/openapi-public/SourceOfFunds'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

dynamoDbSetupHook()
describe('Source of Funds Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_ITERABLE_RISK_ITEM,
      parameter: 'sourceOfFunds' as RiskFactorParameter,
      riskEntityType: 'CONSUMER_USER' as RiskEntityType,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'GIFT',
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
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('sourceOfFunds', 'CONSUMER_USER') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      sourceOfFunds: ['Gift'] as SourceOfFunds[],
    }
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
  test('V8 result should handle empty riskLevelAssignmentValues', async () => {
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('sourceOfFunds', 'CONSUMER_USER') ??
        (() => [])
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
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      sourceOfFunds: ['Gift'],
    }
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
  test('V8 result should be able to handle empty source of funds', async () => {
    const riskFactor = {
      ...TEST_ITERABLE_RISK_ITEM,
      parameter: 'sourceOfFunds' as RiskFactorParameter,
      riskEntityType: 'CONSUMER_USER' as RiskEntityType,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'Gift',
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
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('sourceOfFunds', 'CONSUMER_USER') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 10,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      sourceOfFunds: [] as SourceOfFunds[],
    }
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
    expect(10).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle null source of funds', async () => {
    const riskFactor = {
      ...TEST_ITERABLE_RISK_ITEM,
      parameter: 'sourceOfFunds' as RiskFactorParameter,
      riskEntityType: 'CONSUMER_USER' as RiskEntityType,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'GIFT',
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
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('sourceOfFunds', 'CONSUMER_USER') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      sourceOfFunds: undefined,
    }
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
})
