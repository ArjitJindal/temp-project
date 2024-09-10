import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModelsSample = (): RuleMLModel[] => {
  return [
    {
      id: 'ML-001',
      name: 'ML Model - Fraud (Generic)',
      description: 'Model to detect overall fraud across all payment methods',
      modelType: 'EXPLAINABLE',
      checksFor: ['Fraud'],
      enabled: true,
    },
    {
      id: 'ML-002',
      name: 'ML Model - Fraud credit card',
      description: 'Model to detect overall fraud of the credit card',
      modelType: 'EXPLAINABLE',
      checksFor: ['Credit card fraud'],
      enabled: true,
    },
    {
      id: 'ML-003',
      name: 'ML Model - Money laundering',
      description: 'Model to detect money laundering',
      modelType: 'EXPLAINABLE',
      checksFor: ['Money laundering'],
      enabled: true,
    },
    {
      id: 'ML-004',
      name: 'ML Model - Bank transfer',
      description: 'Model to detect overall fraud in Bank transfer',
      modelType: 'NON_EXPLAINABLE',
      checksFor: ['Fraud', 'Bank Fraud'],
      enabled: true,
    },
  ]
}
