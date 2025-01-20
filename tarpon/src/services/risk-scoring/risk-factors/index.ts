import { memoize } from 'lodash'
import { getRiskLevelAndScore } from '../utils'
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
