import get from 'lodash/get'
import memoize from 'lodash/memoize'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import { getRiskLevelAndScore } from '../utils'
import {
  DERIVED_PARAM_LIST,
  getTransactionDerivedRiskFactorHandler,
  getUserDerivedRiskFactorHandler,
} from '../derived-risk-factors'
import {
  CONSUMER_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  countryOfNationalityV8Logic,
} from './user/country-of-nationality'
import {
  CONSUMER_COUNTRY_OF_RESIDENCE_RISK_FACTOR,
  countryOfResidenceV8Logic,
} from './user/country-of-residence'
import {
  CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
  customerAgeV8Logic,
} from './user/customer-age'
import {
  BUSINESS_TYPE_RISK_FACTOR,
  CONSUMER_TYPE_RISK_FACTOR,
  customerTypeV8Logic,
} from './user/customer-type'
import {
  CONSUMER_USER_OCCUPATION_RISK_FACTOR,
  userOccupationV8Logic,
} from './user/user-occupation'
import {
  RiskFactorLogicGenerator,
  RiskFactorMigrationEntry,
  V2V8RiskFactor,
  V8MigrationParameters,
} from './types'
import {
  BUSINESS_INDUSTRY_RISK_FACTOR,
  businessIndustryV8Logic,
} from './user/business-industry'
import {
  BUSINESS_USER_REGISTRATION_STATUS_RISK_FACTOR,
  userRegistrationStatusV8Logic,
} from './user/user-registration-status'
import {
  BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR,
  businessRegistrationCountryV8Logic,
} from './user/business-registration-country'
import {
  BUSINESS_COMPANY_AGE_RISK_FACTOR,
  companyAgeV8Logic,
} from './user/company-age'
import {
  BUSINESS_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  directorsCountryOfNationalityV8Logic,
} from './user/directors-country-of-nationality'
import {
  BUSINESS_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  shareholdersCountryOfNationalityV8Logic,
} from './user/shareholders-country-of-nationality'
import {
  BUSINESS_USER_SEGMENT_RISK_FACTOR,
  businessUserSegmentV8Logic,
  CONSUMER_USER_SEGMENT_RISK_FACTOR,
  consumerUserSegmentV8Logic,
} from './user/user-segment'
import {
  CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
  userEmploymentStatusV8Logic,
} from './user/user-employment-status'
import {
  CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
  reasonForAccountOpeningV8Logic,
} from './user/account-opening'
import {
  CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
  sourceOfFundsV8Logic,
} from './user/source-of-funds'
import {
  TRANSACTION_ORIGIN_PAYMENT_METHOD_RISK_FACTOR,
  originPaymentMethodV8Logic,
} from './transaction/origin-payment-method'
import {
  TRANSACTION_DESTINATION_PAYMENT_METHOD_RISK_FACTOR,
  destinationPaymentMethodV8Logic,
} from './transaction/destination-payment-method'
import {
  originCountryV8Logic,
  TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
} from './transaction/origin-country'
import {
  destinationCountryV8Logic,
  TRANSACTION_DESTINATION_COUNTRY_RISK_FACTOR,
} from './transaction/destination-country'
import {
  originCurrencyV8Logic,
  TRANSACTION_ORIGIN_CURRENCY_RISK_FACTOR,
} from './transaction/origin-currency'
import {
  destinationCurrencyV8Logic,
  TRANSACTION_DESTINATION_CURRENCY_RISK_FACTOR,
} from './transaction/destination-currency'
import {
  consumerUserAgePlatformV8Logic,
  TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR,
} from './transaction/consumer-user-age-platform'
import {
  businessUserAgePlatformV8Logic,
  TRANSACTION_BUSINESS_USER_AGE_PLATFORM_RISK_FACTOR,
} from './transaction/business-user-age-platform'
import {
  ipAddressCountryV8Logic,
  TRANSACTION_IP_ADDRESS_COUNTRY_RISK_FACTOR,
} from './transaction/ip-address-country'
import {
  TRANSACTION_TIME_FOR_RISK_FACTOR,
  transactionTimeV8Logic,
} from './transaction/transaction-time'
import {
  threeDsDoneV8Logic,
  TRANSACTION_3DS_DONE_RISK_FACTOR,
} from './transaction/3ds-done'
import {
  cardIssuedCountryV8Logic,
  TRANSACTION_CARD_ISSUED_COUNTRY_RISK_FACTOR,
} from './transaction/card-issued-country'
import {
  originMccCodeV8Logic,
  TRANSACTION_ORIGIN_MCC_CODE_RISK_FACTOR,
} from './transaction/origin-MCC-code'
import {
  destinationMccCodeV8Logic,
  TRANSACTION_DESTINATION_MCC_CODE_RISK_FACTOR,
} from './transaction/destination-MCC-code'
import {
  originBankNameV8Logic,
  TRANSACTION_ORIGIN_BANK_NAME_RISK_FACTOR,
} from './transaction/origin-bank-name'
import {
  destinationBankNameV8Logic,
  TRANSACTION_DESTINATION_BANK_NAME_RISK_FACTOR,
} from './transaction/destination-bank-name'
import {
  destinationTransactionAmountV8Logic,
  TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR,
} from './transaction/destination-transaction-amount'
import {
  originTransactionAmountV8Logic,
  TRANSACTION_ORIGIN_TRANSACTION_AMOUNT_RISK_FACTOR,
} from './transaction/origin-transaction-amount'
import {
  foreignDestinationConsumerCountryV8Logic,
  TRANSACTION_FOREIGN_DESTINATION_CONSUMER_COUNTRY_RISK_FACTOR,
} from './transaction/foreign-destination-consumer-country'
import {
  foreignOriginConsumerCountryV8Logic,
  TRANSACTION_FOREIGN_ORIGIN_CONSUMER_COUNTRY_RISK_FACTOR,
} from './transaction/foreign-origin-consumer-country'
import {
  foreignOriginBusinessCountryV8Logic,
  TRANSACTION_FOREIGN_ORIGIN_BUSINESS_COUNTRY_RISK_FACTOR,
} from './transaction/foreign-origin-business-country'
import {
  foreignDestinationBusinessCountryV8Logic,
  TRANSACTION_FOREIGN_DESTINATION_BUSINESS_COUNTRY_RISK_FACTOR,
} from './transaction/foreign-destination-business-country '

import {
  TRANSACTION_TRANSACTION_TYPE_RISK_FACTOR,
  transactionTypeV8Logic,
} from './transaction/transaction-type'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { RiskParameterValueAmountRange } from '@/@types/openapi-internal/RiskParameterValueAmountRange'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskFactorsPostRequest } from '@/@types/openapi-internal/RiskFactorsPostRequest'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { LogicData } from '@/services/logic-evaluator/engine'
import { logger } from '@/core/logger'

//  We will use risk factors from this list to initialise in dynamoDB under the RiskFactors key
export const RISK_FACTORS: V2V8RiskFactor[] = [
  CONSUMER_TYPE_RISK_FACTOR,
  BUSINESS_TYPE_RISK_FACTOR,
  BUSINESS_INDUSTRY_RISK_FACTOR,
  BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR,
  BUSINESS_COMPANY_AGE_RISK_FACTOR,
  BUSINESS_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  BUSINESS_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  BUSINESS_USER_REGISTRATION_STATUS_RISK_FACTOR,
  CONSUMER_COUNTRY_OF_RESIDENCE_RISK_FACTOR,
  CONSUMER_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
  CONSUMER_USER_SEGMENT_RISK_FACTOR,
  BUSINESS_USER_SEGMENT_RISK_FACTOR,
  CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
  CONSUMER_USER_OCCUPATION_RISK_FACTOR,
  CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
  CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
  TRANSACTION_3DS_DONE_RISK_FACTOR,
  TRANSACTION_BUSINESS_USER_AGE_PLATFORM_RISK_FACTOR,
  TRANSACTION_CARD_ISSUED_COUNTRY_RISK_FACTOR,
  TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR,
  TRANSACTION_DESTINATION_BANK_NAME_RISK_FACTOR,
  TRANSACTION_DESTINATION_COUNTRY_RISK_FACTOR,
  TRANSACTION_DESTINATION_CURRENCY_RISK_FACTOR,
  TRANSACTION_DESTINATION_MCC_CODE_RISK_FACTOR,
  TRANSACTION_DESTINATION_PAYMENT_METHOD_RISK_FACTOR,
  TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR,
  TRANSACTION_FOREIGN_DESTINATION_BUSINESS_COUNTRY_RISK_FACTOR,
  TRANSACTION_FOREIGN_DESTINATION_CONSUMER_COUNTRY_RISK_FACTOR,
  TRANSACTION_FOREIGN_ORIGIN_BUSINESS_COUNTRY_RISK_FACTOR,
  TRANSACTION_FOREIGN_ORIGIN_CONSUMER_COUNTRY_RISK_FACTOR,
  TRANSACTION_IP_ADDRESS_COUNTRY_RISK_FACTOR,
  TRANSACTION_ORIGIN_BANK_NAME_RISK_FACTOR,
  TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
  TRANSACTION_ORIGIN_CURRENCY_RISK_FACTOR,
  TRANSACTION_ORIGIN_MCC_CODE_RISK_FACTOR,
  TRANSACTION_ORIGIN_PAYMENT_METHOD_RISK_FACTOR,
  TRANSACTION_ORIGIN_TRANSACTION_AMOUNT_RISK_FACTOR,
  TRANSACTION_TIME_FOR_RISK_FACTOR,
  TRANSACTION_TRANSACTION_TYPE_RISK_FACTOR,
]

function generateV8FactorMigrator(
  logicGenerator: RiskFactorLogicGenerator
): (parameters: V8MigrationParameters) => RiskFactorLogic[] {
  return (parameters: V8MigrationParameters) => {
    const {
      riskLevelAssignmentValues,
      riskClassificationValues,
      defaultWeight,
    } = parameters
    return riskLevelAssignmentValues.map((riskLevelAssignmentValue) => {
      const { riskLevel, riskScore } = getRiskLevelAndScore(
        riskLevelAssignmentValue.riskValue,
        riskClassificationValues
      )
      return {
        logic: logicGenerator(riskLevelAssignmentValue.parameterValue).logic,
        riskLevel,
        riskScore,
        weight: defaultWeight,
      }
    })
  }
}
// List of all risk factor parameters that have a migration
const RISK_FACTOR_MIGRATIONS: RiskFactorMigrationEntry[] = [
  {
    key: 'type',
    logicGenerator: customerTypeV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'type',
    logicGenerator: customerTypeV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'legalEntity.companyGeneralDetails.businessIndustry',
    logicGenerator: businessIndustryV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'legalEntity.companyRegistrationDetails.registrationCountry',
    logicGenerator: businessRegistrationCountryV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    logicGenerator: companyAgeV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'directors',
    logicGenerator: directorsCountryOfNationalityV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'shareHolders',
    logicGenerator: shareholdersCountryOfNationalityV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    logicGenerator: userRegistrationStatusV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'userDetails.countryOfResidence',
    logicGenerator: countryOfResidenceV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'userDetails.countryOfNationality',
    logicGenerator: countryOfNationalityV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'userDetails.dateOfBirth',
    logicGenerator: customerAgeV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'userSegment',
    logicGenerator: consumerUserSegmentV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'legalEntity.companyGeneralDetails.userSegment',
    logicGenerator: businessUserSegmentV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'employmentStatus',
    logicGenerator: userEmploymentStatusV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'occupation',
    logicGenerator: userOccupationV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'reasonForAccountOpening',
    logicGenerator: reasonForAccountOpeningV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'sourceOfFunds',
    logicGenerator: sourceOfFundsV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'originPaymentDetails.method',
    logicGenerator: originPaymentMethodV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationPaymentDetails.method',
    logicGenerator: destinationPaymentMethodV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'originAmountDetails.country',
    logicGenerator: originCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationAmountDetails.country',
    logicGenerator: destinationCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'originAmountDetails.transactionCurrency',
    logicGenerator: originCurrencyV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationAmountDetails.transactionCurrency',
    logicGenerator: destinationCurrencyV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'type',
    logicGenerator: transactionTypeV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'consumerCreatedTimestamp',
    logicGenerator: consumerUserAgePlatformV8Logic,
    type: 'CONSUMER_USER',
  },
  {
    key: 'businessCreatedTimestamp',
    logicGenerator: businessUserAgePlatformV8Logic,
    type: 'BUSINESS',
  },
  {
    key: 'ipAddressCountry',
    logicGenerator: ipAddressCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'timestamp',
    logicGenerator: transactionTimeV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: '3dsDone',
    logicGenerator: threeDsDoneV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'cardIssuedCountry',
    logicGenerator: cardIssuedCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'originMccCode',
    logicGenerator: originMccCodeV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationMccCode',
    logicGenerator: destinationMccCodeV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'originPaymentDetails.bankName',
    logicGenerator: originBankNameV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationPaymentDetails.bankName',
    logicGenerator: destinationBankNameV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'originAmountDetails.transactionAmount',
    logicGenerator: originTransactionAmountV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'destinationAmountDetails.transactionAmount',
    logicGenerator: destinationTransactionAmountV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'domesticOrForeignOriginCountryConsumer',
    logicGenerator: foreignOriginConsumerCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'domesticOrForeignOriginCountryBusiness',
    logicGenerator: foreignOriginBusinessCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'domesticOrForeignDestinationCountryConsumer',
    logicGenerator: foreignDestinationConsumerCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'domesticOrForeignDestinationCountryBusiness',
    logicGenerator: foreignDestinationBusinessCountryV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'consumerCreatedTimestamp',
    logicGenerator: consumerUserAgePlatformV8Logic,
    type: 'TRANSACTION',
  },
  {
    key: 'businessCreatedTimestamp',
    logicGenerator: businessUserAgePlatformV8Logic,
    type: 'TRANSACTION',
  },
]

// Update the map type to use the composite key
export const PARAMETER_MIGRATION_MAP: Record<
  string,
  (parameters: V8MigrationParameters) => RiskFactorLogic[]
> = RISK_FACTOR_MIGRATIONS.reduce((acc, { key, logicGenerator, type }) => {
  // Create composite key as a string for easier lookup
  const compositeKey = `${type}:${key}`
  acc[compositeKey] = generateV8FactorMigrator(logicGenerator)
  return acc
}, {} as Record<string, (parameters: V8MigrationParameters) => RiskFactorLogic[]>)

const getRiskFactorLogicByKeyAndType = memoize(
  (
    key: string,
    type: RiskEntityType
  ): ((parameters: V8MigrationParameters) => RiskFactorLogic[]) | undefined => {
    const compositeKey = `${type}:${key}`
    return PARAMETER_MIGRATION_MAP[compositeKey]
  },
  // Memoization resolver - creates unique cache key from arguments
  (key: string, type: RiskEntityType) => `${type}:${key}`
)

export { getRiskFactorLogicByKeyAndType }

export function createV8FactorFromV2(
  v2Factor: ParameterAttributeRiskValues,
  riskClassification: RiskClassificationScore[]
): Partial<RiskFactorsPostRequest> {
  const riskLevelLogic = createRiskLevelLogic(v2Factor, riskClassification)
  const initialDefault = RISK_FACTORS.find(
    (val) =>
      val.parameter === v2Factor.parameter &&
      v2Factor.riskEntityType === val.type
  )
  return {
    ...initialDefault,
    riskLevelLogic,
    defaultWeight: v2Factor.weight,
    type: v2Factor.riskEntityType,
    riskLevelAssignmentValues: v2Factor.riskLevelAssignmentValues,
    ...createDefaultRiskValues(v2Factor, riskClassification),
    status: (v2Factor.isActive ? 'ACTIVE' : 'INACTIVE') as RuleInstanceStatus,
    baseCurrency: extractBaseCurrency(v2Factor),
  }
}

export function createRiskLevelLogic(
  v2Factor: ParameterAttributeRiskValues,
  riskClassification: RiskClassificationScore[]
) {
  const logicMigrator = getRiskFactorLogicByKeyAndType(
    v2Factor.parameter,
    v2Factor.riskEntityType
  )

  return logicMigrator
    ? logicMigrator({
        riskLevelAssignmentValues: v2Factor.riskLevelAssignmentValues,
        riskClassificationValues: riskClassification,
        defaultWeight: v2Factor.weight,
      })
    : []
}

export function createDefaultRiskValues(
  v2Factor: ParameterAttributeRiskValues,
  riskClassification: RiskClassificationScore[]
) {
  const { type, value } = v2Factor.defaultValue
  return {
    defaultRiskLevel:
      type === 'RISK_LEVEL'
        ? value
        : getRiskLevelFromScore(riskClassification, value),
    defaultRiskScore:
      type === 'RISK_SCORE'
        ? value
        : getRiskScoreFromLevel(riskClassification, value),
  }
}

export async function extractParamValues(
  param: RiskFactorParameter,
  riskData: LogicData,
  type: RiskEntityType,
  targetIterableParameter?: ParameterAttributeRiskValuesTargetIterableParameterEnum
) {
  logger.debug(DERIVED_PARAM_LIST(type === 'TRANSACTION' ? type : 'USER'))
  if (
    !DERIVED_PARAM_LIST(type === 'TRANSACTION' ? type : 'USER').includes(param)
  ) {
    if (
      targetIterableParameter &&
      type === 'BUSINESS' &&
      riskData.type === 'USER'
    ) {
      return riskData.user[param].map((p) => get(p, targetIterableParameter))
    }
    return get(
      riskData.type === 'TRANSACTION' ? riskData.transaction : riskData.user,
      param
    )
  }
  if (riskData.type === 'TRANSACTION') {
    const handler = getTransactionDerivedRiskFactorHandler(type, param)
    if (!handler) {
      logger.error(`No handler found for risk factor ${param}`)
      return undefined
    }
    // Todo: Improve this to handle IP address country for both directions.
    return (
      await handler(
        riskData.transaction,
        {
          originUser: riskData.senderUser ?? null,
          destinationUser: riskData.receiverUser ?? null,
        },
        param
      )
    )?.[0]
  }
  const handler = getUserDerivedRiskFactorHandler(type, param)
  if (!handler) {
    logger.error(`No handler found for risk factor ${param}`)
    return undefined
  }
  return (await handler(riskData.user, param))?.[0]
}

export function extractBaseCurrency(
  v2Factor: ParameterAttributeRiskValues
): CurrencyCode {
  const firstAssignment = v2Factor.riskLevelAssignmentValues?.[0]
  const parameterContent = firstAssignment?.parameterValue
    ?.content as RiskParameterValueAmountRange
  return parameterContent?.currency ?? 'USD'
}
