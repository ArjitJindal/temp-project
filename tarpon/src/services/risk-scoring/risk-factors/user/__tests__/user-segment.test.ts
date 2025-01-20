import { RiskScoringService } from '../../..'
import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../..'
import {
  BUSINESS_USER_SEGMENT_RISK_FACTOR,
  CONSUMER_USER_SEGMENT_RISK_FACTOR,
} from '../../user/user-segment'
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
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { ConsumerUserSegment } from '@/@types/openapi-public/ConsumerUserSegment'
import {
  BusinessUserSegment,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/@types/openapi-internal/all'
dynamoDbSetupHook()
describe('User Segment Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result for consumer user segment', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'RETAIL',
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
      ...CONSUMER_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('userSegment', 'CONSUMER_USER') ??
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
      userSegment: 'RETAIL',
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
  test('V8 result should handle empty riskLevelAssignmentValues for consumer user segment', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [] as RiskParameterLevelKeyValue[], // Empty riskLevelAssignmentValues
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('userSegment', 'CONSUMER_USER') ??
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
      userSegment: 'RETAIL',
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
  test('V8 result should be able to handle null user segment for consumer user', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'RETAIL',
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
      ...CONSUMER_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('userSegment', 'CONSUMER_USER') ??
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
      userSegment: undefined,
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
  test('V8 result should be able to handle empty user segment for consumer user', async () => {
    const riskFactor = {
      ...TEST_CONSUMER_USER_RISK_PARAMETER,
      parameter: 'userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'RETAIL',
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
      ...CONSUMER_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('userSegment', 'CONSUMER_USER') ??
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
      userSegment: '' as ConsumerUserSegment,
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
  // add business user segment test
  test('V8 result should be equivalent to V2 result for business user segment', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'SOLE_PROPRIETORSHIP',
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
      ...BUSINESS_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyGeneralDetails.userSegment',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyGeneralDetails: {
          userSegment: 'SOLE_PROPRIETORSHIP',
        },
      },
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
      businessUser,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user: businessUser,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle empty user segment for business user segment', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'SOLE_PROPRIETORSHIP',
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
      ...BUSINESS_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyGeneralDetails.userSegment',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyGeneralDetails: {
          userSegment: '' as BusinessUserSegment,
        },
      },
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
      businessUser,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user: businessUser,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle undefined user segment for business user segment', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.userSegment' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'SOLE_PROPRIETORSHIP',
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
      ...BUSINESS_USER_SEGMENT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyGeneralDetails.userSegment',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyGeneralDetails: {
          userSegment: undefined,
        },
      },
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
      businessUser,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user: businessUser,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
})
