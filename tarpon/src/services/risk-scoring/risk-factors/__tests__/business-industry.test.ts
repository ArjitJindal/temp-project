import { RiskScoringService } from '../..'
import { RiskScoringV8Service } from '../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../repositories/risk-repository'
import { PARAMETER_MIGRATION_MAP } from '..'
import { BUSINESS_INDUSTRY_RISK_FACTOR } from '../business-industry'
import { TEST_BUSINESS_USER_RISK_PARAMETER } from '@/test-utils/pulse-test-utils'
import { getTestBusiness } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { ParameterAttributeRiskValuesParameterTypeEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { InternalBusinessUser } from '@/@types/openapi-internal/all'

dynamoDbSetupHook()
describe('Business Industry Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result for business-industry', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.businessIndustry' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'FARMING',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
      parameterType:
        'ITERABLE' as ParameterAttributeRiskValuesParameterTypeEnum,
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_INDUSTRY_RISK_FACTOR,
      riskLevelLogic: PARAMETER_MIGRATION_MAP[
        'legalEntity.companyGeneralDetails.businessIndustry'
      ]({
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
          ...getTestBusiness().legalEntity.companyGeneralDetails,
          businessIndustry: ['FARMING'],
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
  test('V8 result should be able to handle empty business industry', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.businessIndustry' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'FARMING',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
      parameterType:
        'ITERABLE' as ParameterAttributeRiskValuesParameterTypeEnum,
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_INDUSTRY_RISK_FACTOR,
      riskLevelLogic: PARAMETER_MIGRATION_MAP[
        'legalEntity.companyGeneralDetails.businessIndustry'
      ]({
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
          ...getTestBusiness().legalEntity.companyGeneralDetails,
          businessIndustry: [],
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
  test('V8 result should be able to handle undefined business industry', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyGeneralDetails.businessIndustry' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: 'FARMING',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'VERY_HIGH',
          },
        },
      ] as RiskParameterLevelKeyValue[],
      parameterType:
        'ITERABLE' as ParameterAttributeRiskValuesParameterTypeEnum,
    }
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...BUSINESS_INDUSTRY_RISK_FACTOR,
      riskLevelLogic: PARAMETER_MIGRATION_MAP[
        'legalEntity.companyGeneralDetails.businessIndustry'
      ]({
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
          ...getTestBusiness().legalEntity.companyGeneralDetails,
          businessIndustry: undefined,
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
