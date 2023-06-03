import { addNewPulseRiskParameterField } from '../utils/pulse'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

export const up = async () => {
  const parametersRiskScoreType: {
    parameterName: string
    newField: {
      riskScoreType: string
    }
    entityType: RiskEntityType
  }[] = [
    {
      parameterName: 'type',
      newField: { riskScoreType: 'KRS' },
      entityType: 'CONSUMER_USER',
    },
    {
      parameterName: 'userDetails.countryOfResidence',
      newField: { riskScoreType: 'KRS' },
      entityType: 'CONSUMER_USER',
    },
    {
      parameterName: 'userDetails.countryOfNationality',
      newField: { riskScoreType: 'KRS' },
      entityType: 'CONSUMER_USER',
    },
    {
      parameterName: 'userDetails.dateOfBirth',
      newField: { riskScoreType: 'KRS' },
      entityType: 'CONSUMER_USER',
    },
    {
      parameterName:
        'legalEntity.companyRegistrationDetails.registrationCountry',
      newField: { riskScoreType: 'KRS' },
      entityType: 'BUSINESS',
    },
    {
      parameterName: 'shareHolders',
      newField: { riskScoreType: 'KRS' },
      entityType: 'BUSINESS',
    },
    {
      parameterName: 'directors',
      newField: { riskScoreType: 'KRS' },
      entityType: 'BUSINESS',
    },
    {
      parameterName: 'legalEntity.companyGeneralDetails.businessIndustry',
      newField: { riskScoreType: 'KRS' },
      entityType: 'BUSINESS',
    },
    {
      parameterName:
        'legalEntity.companyRegistrationDetails.dateOfRegistration',
      newField: { riskScoreType: 'KRS' },
      entityType: 'BUSINESS',
    },

    {
      parameterName: 'originPaymentDetails.method',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'destinationPaymentDetails.method',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'originAmountDetails.country',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'destinationAmountDetails.country',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'originAmountDetails.transactionCurrency',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'destinationAmountDetails.transactionCurrency',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
    {
      parameterName: 'createdTimestamp',
      newField: { riskScoreType: 'ARS' },
      entityType: 'CONSUMER_USER',
    },
    {
      parameterName: 'ipAddressCountry',
      newField: { riskScoreType: 'ARS' },
      entityType: 'TRANSACTION',
    },
  ]
  for (const parameterUpdate of parametersRiskScoreType) {
    await addNewPulseRiskParameterField(parameterUpdate)
  }
}
export const down = async () => {
  // skip
}
