import { RiskScoringService } from '../..'
import { RiskScoringV8Service } from '../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '..'
import { CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR } from '../user-employment-status'
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
import { EmploymentStatus } from '@/@types/openapi-public/EmploymentStatus'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

dynamoDbSetupHook()
describe('User Employment Status Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'employmentStatus' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'Student',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_SCORE',
            value: 50,
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('employmentStatus', 'CONSUMER_USER') ??
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
      employmentStatus: 'STUDENT',
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.calculateKrsScore(
      user,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should handle empty riskLevelAssignmentValues', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'employmentStatus' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [] as RiskParameterLevelKeyValue[], // Empty riskLevelAssignmentValues
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('employmentStatus', 'CONSUMER_USER') ??
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
      employmentStatus: 'STUDENT' as EmploymentStatus,
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.calculateKrsScore(
      user,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle null employment status', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'employmentStatus' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'Student',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_SCORE',
            value: 50,
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('employmentStatus', 'CONSUMER_USER') ??
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
      employmentStatus: undefined,
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.calculateKrsScore(
      user,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle empty employment status', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'employmentStatus' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'Student',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_SCORE',
            value: 50,
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('employmentStatus', 'CONSUMER_USER') ??
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
    const user = {
      ...getTestUser(),
      type: 'CONSUMER',
      employmentStatus: '' as EmploymentStatus,
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.calculateKrsScore(
      user,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
})
