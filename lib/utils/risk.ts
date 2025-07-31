import { mean } from 'lodash'

type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

type RiskClassificationScore = {
  riskLevel: RiskLevel
  lowerBoundRiskScore: number
  upperBoundRiskScore: number
}

export const DEFAULT_RISK_LEVEL: RiskLevel = 'VERY_HIGH'

export const DEFAULT_RISK_VALUE = {
  type: 'RISK_LEVEL',
  value: DEFAULT_RISK_LEVEL,
}

export const BUSINESS_RISK_PARAMETERS = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for businesses (merchants/legal entities) users',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
    title: 'Business registration country',
    description: 'Risk value based on registration country of the business',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'shareHolders',
    title: 'Shareholders country of nationality',
    description: 'Risk value based on shareholder country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'directors',
    title: 'Directors country of nationality',
    description: 'Risk value based on director country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
    title: 'Business industry',
    description:
      'Risk value based on the industry in which the business operates',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_INDUSTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    title: 'Company age',
    description: 'Risk based on business age range (years)',
    entity: 'BUSINESS',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userSegment',
    title: 'User segment',
    description: 'Risk based on business user segment',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    title: 'User registration status',
    description: 'Risk based on business user registration status',
    entity: 'BUSINESS',
    dataType: 'USER_REGISTRATION_STATUS',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
]

export const TRANSACTION_RISK_PARAMETERS = [
  {
    parameter: 'originPaymentDetails.method',
    title: 'Origin payment method',
    description: 'Risk based on transaction origin payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationPaymentDetails.method',
    title: 'Destination payment method',
    description: 'Risk based on transaction destination payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originAmountDetails.country',
    title: 'Origin country',
    description: 'Risk based on transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.country',
    title: 'Destination country',
    description: 'Risk based on transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originAmountDetails.transactionCurrency',
    title: 'Origin currency',
    description: 'Risk based on transaction origin currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.transactionCurrency',
    title: 'Destination currency',
    description: 'Risk based on transaction destination currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'consumerCreatedTimestamp',
    title: 'Consumer user age on platform',
    description:
      'Risk based on how long a consumer has been using your platform (days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'businessCreatedTimestamp',
    title: 'Business user age on platform',
    description:
      'Risk based on how long a business has been using your platform (Days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'ipAddressCountry',
    title: 'IP address country',
    description: 'Risk based on IP address country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'type',
    title: 'Transaction type',
    description: 'Risk value based on type of transaction',
    entity: 'TRANSACTION',
    dataType: 'TRANSACTION_TYPES',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignOriginCountryConsumer',
    title: 'Foreign origin country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignDestinationCountryConsumer',
    title: 'Foreign destination country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignOriginCountryBusiness',
    title: 'Foreign origin country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignDestinationCountryBusiness',
    title: 'Foreign destination country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'timestamp',
    title: 'Transaction time',
    description: 'Risk value based on time of transaction',
    entity: 'TRANSACTION',
    dataType: 'TIME_RANGE',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: '3dsDone',
    title: '3DS Done',
    description: 'Risk value based on whether 3DS was done on CARD transaction',
    entity: 'TRANSACTION',
    dataType: 'BOOLEAN',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'cardIssuedCountry',
    title: 'Card issued country',
    description: 'Risk value based on card issued country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originMccCode',
    title: 'Origin MCC code',
    description: 'Risk value based on Origin MCC code',
    entity: 'TRANSACTION',
    dataType: 'STRING',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationMccCode',
    title: 'Destination MCC code',
    description: 'Risk value based on Destination MCC code',
    entity: 'TRANSACTION',
    dataType: 'STRING',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originPaymentDetails.bankName',
    title: 'Origin bank name',
    description:
      'Risk value based on origin bank name under generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationPaymentDetails.bankName',
    title: 'Destination bank name',
    description:
      'Risk value based on destination bank name under generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originUserSarFiled',
    title: 'Origin user SAR filed',
    description:
      'Risk value based on whether a SAR was filed for the origin user',
    entity: 'TRANSACTION',
    dataType: 'BOOLEAN',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
    requiredFeatures: ['SAR', 'DEMO_MODE'],
  },
  {
    parameter: 'destinationUserSarFiled',
    title: 'Destination user SAR filed',
    description:
      'Risk value based on whether a SAR was filed for the destination user',
    entity: 'TRANSACTION',
    dataType: 'CARD_3DS_STATUS',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
    requiredFeatures: ['SAR', 'DEMO_MODE'],
  },
  {
    parameter: 'originAmountDetails.transactionAmount',
    title: 'Origin transaction amount',
    description: 'Risk based on origin transaction amount',
    entity: 'TRANSACTION',
    dataType: 'AMOUNT_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: false,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.transactionAmount',
    title: 'Destination transaction amount',
    description: 'Risk based on destination transaction amount',
    entity: 'TRANSACTION',
    dataType: 'AMOUNT_RANGE',
    parameterType: 'VARIABLE',
    isDerived: true,
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
]

export const USER_RISK_PARAMETERS = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for consumer (individuals) users',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.countryOfResidence',
    title: 'Country of residence',
    description: 'Risk based on customer residence country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.countryOfNationality',
    title: 'Country of nationality',
    description: 'Risk based on customer nationality country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.dateOfBirth',
    title: 'Customer age',
    description: 'Risk based on customer age range (years)',
    entity: 'CONSUMER_USER',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userSegment',
    title: 'User segment',
    description: 'Risk based on consumer user segment',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'employmentStatus',
    title: 'User employment status',
    description: 'Risk based on consumer employment status',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_EMPLOYMENT_STATUS',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'occupation',
    title: 'User occupation',
    description: 'Risk based on consumer occupation',
    entity: 'CONSUMER_USER',
    dataType: 'STRING',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'reasonForAccountOpening',
    title: 'Reason for account opening',
    description: 'Risk based on reason for account opening',
    entity: 'CONSUMER_USER',
    dataType: 'STRING',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'sourceOfFunds',
    title: 'Source of funds',
    description: 'Risk based on source of funds',
    entity: 'CONSUMER_USER',
    dataType: 'SOURCE_OF_FUNDS',
    isDerived: false,
    parameterType: 'ITERABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
]

export const DRS_CHANGE_PSEUDO_TX_IDS = [
  'USER_UPDATED',
  'FIRST_DRS',
  'MANUAL_UPDATE',
  'USER_UPDATE',
  'RISK_SCORING_RERUN',
]

export function isNotArsChangeTxId(transactionId?: string) {
  return DRS_CHANGE_PSEUDO_TX_IDS.includes(transactionId ?? '')
}

export function isManualDrsTxId(transactionId: string) {
  return transactionId === 'MANUAL_UPDATE'
}

export const ALL_RISK_PARAMETERS = [
  ...USER_RISK_PARAMETERS,
  ...BUSINESS_RISK_PARAMETERS,
  ...TRANSACTION_RISK_PARAMETERS,
]

export const getRiskLevelFromScore = (
  riskClassificationValues: Array<RiskClassificationScore>,
  riskScore: number | null
): RiskLevel => {
  if (riskScore === null) {
    return DEFAULT_RISK_LEVEL
  }

  let riskLevel: RiskLevel | undefined
  riskClassificationValues.map((value) => {
    if (
      riskScore >= value.lowerBoundRiskScore &&
      riskScore < value.upperBoundRiskScore
    ) {
      riskLevel = value.riskLevel
    }
  })
  return riskLevel ? riskLevel : DEFAULT_RISK_LEVEL
}

export const getRiskScoreFromLevel = (
  riskClassificationValues: Array<RiskClassificationScore>,
  riskLevel: RiskLevel
): number => {
  let calculatedRiskScore = 75

  riskClassificationValues.forEach((value) => {
    if (riskLevel == value.riskLevel) {
      calculatedRiskScore = mean([
        value.upperBoundRiskScore,
        value.lowerBoundRiskScore,
      ])
    }
  })

  return calculatedRiskScore
}
