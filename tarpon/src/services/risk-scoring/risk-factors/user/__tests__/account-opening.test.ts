import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../../'
import { CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR } from '../../user/account-opening'
import { TEST_CONSUMER_USER_RISK_PARAMETER } from '@/test-utils/pulse-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
dynamoDbSetupHook()
describe('Reason for Account Opening Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'reasonForAccountOpening' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'Investment',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',

      ...CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'reasonForAccountOpening',
          'CONSUMER_USER'
        ) ?? (() => [])
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
      reasonForAccountOpening: ['Investment'],
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
      ...CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'reasonForAccountOpening',
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
      reasonForAccountOpening: [],
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb, dynamoDb }
    )

    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      { user, type: 'USER' }
    )

    expect(90).toEqual(v8Result.score)
  })
  test('V8 result should handle empty string as reason for account opening', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'reasonForAccountOpening' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'Investment',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'reasonForAccountOpening',
          'CONSUMER_USER'
        ) ?? (() => [])
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
    const user = {
      ...getTestUser(),
      type: 'CONSUMER',
      reasonForAccountOpening: [],
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb, dynamoDb }
    )

    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      { user, type: 'USER' }
    )

    expect(90).toEqual(v8Result.score)
  })
  test('V8 result should handle undefined as reason for account opening', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'reasonForAccountOpening' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'Security',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'reasonForAccountOpening',
          'CONSUMER_USER'
        ) ?? (() => [])
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
      reasonForAccountOpening: undefined,
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb, dynamoDb }
    )

    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      { user, type: 'USER' }
    )
    expect(90).toEqual(v8Result.score)
  })
})
