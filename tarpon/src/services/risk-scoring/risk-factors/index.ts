import { getRiskLevelAndScore } from '../utils'
import {
  CONSUMER_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  countryOfNationalityV8Logic,
} from './country-of-nationality'
import {
  CONSUMER_COUNTRY_OF_RESIDENCE_RISK_FACTOR,
  countryOfResidenceV8Logic,
} from './country-of-residence'
import {
  CONSUMER_CUSTOMER_AGE_RISK_FACTOR,
  customerAgeV8Logic,
} from './customer-age'
import {
  BUSINESS_TYPE_RISK_FACTOR,
  CONSUMER_TYPE_RISK_FACTOR,
  customerTypeV8Logic,
} from './customer-type'
import {
  CONSUMER_USER_OCCUPATION_RISK_FACTOR,
  userOccupationV8Logic,
} from './user-occupation'
import {
  RiskFactorLogicGenerator,
  RiskFactorMigrationEntry,
  V2V8RiskFactor,
  V8MigrationParameters,
} from './types'
import {
  BUSINESS_INDUSTRY_RISK_FACTOR,
  businessIndustryV8Logic,
} from './business-industry'
import {
  BUSINESS_USER_REGISTRATION_STATUS_RISK_FACTOR,
  userRegistrationStatusV8Logic,
} from './user-registration-status'
import {
  BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR,
  businessRegistrationCountryV8Logic,
} from './business-registration-country'
import {
  BUSINESS_COMPANY_AGE_RISK_FACTOR,
  companyAgeV8Logic,
} from './company-age'
import {
  BUSINESS_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  directorsCountryOfNationalityV8Logic,
} from './directors-country-of-nationality'
import {
  BUSINESS_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR,
  shareholdersCountryOfNationalityV8Logic,
} from './shareholders-country-of-nationality'
import {
  BUSINESS_USER_SEGMENT_RISK_FACTOR,
  businessUserSegmentV8Logic,
  CONSUMER_USER_SEGMENT_RISK_FACTOR,
  consumerUserSegmentV8Logic,
} from './user-segment'
import {
  CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR,
  userEmploymentStatusV8Logic,
} from './user-employment-status'
import {
  CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR,
  reasonForAccountOpeningV8Logic,
} from './account-opening'
import {
  CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR,
  sourceOfFundsV8Logic,
} from './source-of-funds'

import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'

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
  },
  {
    key: 'legalEntity.companyGeneralDetails.businessIndustry',
    logicGenerator: businessIndustryV8Logic,
  },
  {
    key: 'legalEntity.companyRegistrationDetails.registrationCountry',
    logicGenerator: businessRegistrationCountryV8Logic,
  },
  {
    key: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    logicGenerator: companyAgeV8Logic,
  },
  {
    key: 'directors',
    logicGenerator: directorsCountryOfNationalityV8Logic,
  },
  {
    key: 'shareHolders',
    logicGenerator: shareholdersCountryOfNationalityV8Logic,
  },
  {
    key: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    logicGenerator: userRegistrationStatusV8Logic,
  },
  {
    key: 'userDetails.countryOfResidence',
    logicGenerator: countryOfResidenceV8Logic,
  },
  {
    key: 'userDetails.countryOfNationality',
    logicGenerator: countryOfNationalityV8Logic,
  },
  {
    key: 'userDetails.dateOfBirth',
    logicGenerator: customerAgeV8Logic,
  },
  {
    key: 'userSegment',
    logicGenerator: consumerUserSegmentV8Logic,
  },
  {
    key: 'legalEntity.companyGeneralDetails.userSegment',
    logicGenerator: businessUserSegmentV8Logic,
  },
  {
    key: 'employmentStatus',
    logicGenerator: userEmploymentStatusV8Logic,
  },
  {
    key: 'occupation',
    logicGenerator: userOccupationV8Logic,
  },
  {
    key: 'reasonForAccountOpening',
    logicGenerator: reasonForAccountOpeningV8Logic,
  },
  {
    key: 'sourceOfFunds',
    logicGenerator: sourceOfFundsV8Logic,
  },
]

// Map of risk factor parameters to their migration logic
export const PARAMETER_MIGRATION_MAP: Record<
  Partial<RiskFactorParameter>,
  (parameters: V8MigrationParameters) => RiskFactorLogic[]
> = RISK_FACTOR_MIGRATIONS.reduce((acc, { key, logicGenerator }) => {
  acc[key] = generateV8FactorMigrator(logicGenerator)
  return acc
}, {} as Record<Partial<RiskFactorParameter>, (parameters: V8MigrationParameters) => RiskFactorLogic[]>)
