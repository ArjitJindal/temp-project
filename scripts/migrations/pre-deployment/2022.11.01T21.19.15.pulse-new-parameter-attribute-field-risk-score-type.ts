import { addNewPulseRiskParameterField } from '../utils/pulse'

export const up = async () => {
  const parametersRiskScoreType = [
    {
      parameterName: 'type',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'userDetails.countryOfResidence',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'userDetails.countryOfNationality',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'userDetails.dateOfBirth',

      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName:
        'legalEntity.companyRegistrationDetails.registrationCountry',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'shareHolders',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'directors',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName: 'legalEntity.companyGeneralDetails.businessIndustry',
      newField: { riskScoreType: 'KRS' },
    },
    {
      parameterName:
        'legalEntity.companyRegistrationDetails.dateOfRegistration',
      newField: { riskScoreType: 'KRS' },
    },

    {
      parameterName: 'originPaymentDetails.method',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'destinationPaymentDetails.method',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'originAmountDetails.country',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'destinationAmountDetails.country',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'originAmountDetails.transactionCurrency',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'destinationAmountDetails.transactionCurrency',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'createdTimestamp',
      newField: { riskScoreType: 'ARS' },
    },
    {
      parameterName: 'ipAddressCountry',
      newField: { riskScoreType: 'ARS' },
    },
  ]
  for (const parameterUpdate of parametersRiskScoreType) {
    await addNewPulseRiskParameterField(parameterUpdate)
  }
}
export const down = async () => {
  // skip
}
