import { RiskScoringService } from '../../..'
import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../..'
import { BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR } from '../../user/business-registration-country'
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
import { InternalBusinessUser } from '@/@types/openapi-internal/all'
dynamoDbSetupHook()
describe('Country of Nationality Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyRegistrationDetails.registrationCountry' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'AL',
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
      ...BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyRegistrationDetails.registrationCountry',
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
        companyRegistrationDetails: {
          ...getTestBusiness().legalEntity.companyRegistrationDetails,
          registrationCountry: 'AL',
          registrationIdentifier: '1234567890',
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
  test('V8 result should be able to handel empty business-registration-country', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyRegistrationDetails.registrationCountry' as RiskFactorParameter,
      isDerived: false,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'AL',
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
      ...BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyRegistrationDetails.registrationCountry',
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
