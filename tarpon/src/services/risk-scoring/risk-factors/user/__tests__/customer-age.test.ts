import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../..'
import { CONSUMER_CUSTOMER_AGE_RISK_FACTOR } from '../../user/customer-age'
import { TEST_CONSUMER_USER_RISK_PARAMETER } from '@/test-utils/pulse-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

dynamoDbSetupHook()
describe('Customer Age Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userDetails.dateOfBirth' as RiskFactorParameter,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              start: 25,
              kind: 'RANGE',
              end: 50,
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'userDetails.dateOfBirth',
          'CONSUMER_USER'
        ) ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 1,
      }),
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      userDetails: {
        ...getTestUser().userDetails,
        dateOfBirth: '1990-01-01',
      },
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
    expect(50).toEqual(v8Result.score)
  })
  test('V8 result should handle empty riskLevelAssignmentValues', async () => {
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'userDetails.dateOfBirth',
          'CONSUMER_USER'
        ) ?? (() => [])
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
      userDetails: {
        ...getTestUser().userDetails,
        dateOfBirth: '1990-01-01',
      },
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
  test('V8 result should able to handle null dateOfBirth', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userDetails.dateOfBirth' as RiskFactorParameter,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              start: 25,
              kind: 'RANGE',
              end: 50,
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'userDetails.dateOfBirth',
          'CONSUMER_USER'
        ) ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 1,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      userDetails: {
        ...getTestUser().userDetails,
        dateOfBirth: undefined,
      },
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
  test('V8 result should able to handle empty dateOfBirth', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userDetails.dateOfBirth' as RiskFactorParameter,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              start: 25,
              kind: 'RANGE',
              end: 50,
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'userDetails.dateOfBirth',
          'CONSUMER_USER'
        ) ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 1,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user: InternalConsumerUser = {
      ...getTestUser(),
      type: 'CONSUMER',
      userDetails: {
        ...getTestUser().userDetails,
        dateOfBirth: '',
      },
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
