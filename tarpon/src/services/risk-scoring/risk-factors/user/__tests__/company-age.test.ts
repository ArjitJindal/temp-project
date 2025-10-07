import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { getRiskFactorLogicByKeyAndType } from '../..'
import { BUSINESS_COMPANY_AGE_RISK_FACTOR } from '../../user/company-age'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/constants/risk/classification'
import { TEST_BUSINESS_USER_RISK_PARAMETER } from '@/test-utils/pulse-test-utils'
import { getTestBusiness } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { InternalBusinessUser } from '@/@types/openapi-internal/all'

dynamoDbSetupHook()
describe('Company Age Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyRegistrationDetails.dateOfRegistration' as RiskFactorParameter,
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
      ...BUSINESS_COMPANY_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyRegistrationDetails.dateOfRegistration',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyRegistrationDetails: {
          ...getTestBusiness().legalEntity.companyRegistrationDetails,
          dateOfRegistration: '1990-01-01',
          registrationIdentifier: '1234567890',
          registrationCountry: 'AL',
        },
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
        user: businessUser,
        type: 'USER',
      }
    )
    expect(50).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle empty business-company-registration-date', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyRegistrationDetails.dateOfRegistration' as RiskFactorParameter,
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
      ...BUSINESS_COMPANY_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyRegistrationDetails.dateOfRegistration',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyRegistrationDetails: {
          ...getTestBusiness().legalEntity.companyRegistrationDetails,
          dateOfRegistration: '',
          registrationIdentifier: '1234567890',
          registrationCountry: 'AL',
        },
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
        user: businessUser,
        type: 'USER',
      }
    )
    expect(90).toEqual(v8Result.score)
  })
  test('V8 result should be able to handle undefined business-company-registration-date', async () => {
    const riskFactor = {
      ...TEST_BUSINESS_USER_RISK_PARAMETER,
      parameter:
        'legalEntity.companyRegistrationDetails.dateOfRegistration' as RiskFactorParameter,
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
      ...BUSINESS_COMPANY_AGE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'legalEntity.companyRegistrationDetails.dateOfRegistration',
          'BUSINESS'
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
    const businessUser: InternalBusinessUser = {
      ...getTestBusiness(),
      type: 'BUSINESS',
      legalEntity: {
        ...getTestBusiness().legalEntity,
        companyRegistrationDetails: {
          ...getTestBusiness().legalEntity.companyRegistrationDetails,
          dateOfRegistration: undefined,
          registrationIdentifier: '1234567890',
          registrationCountry: 'AL',
        },
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
        user: businessUser,
        type: 'USER',
      }
    )
    expect(90).toEqual(v8Result.score)
  })
})
