import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModelsSample = (): RuleMLModel[] => {
  return [
    {
      id: 'ML-001',
      name: 'ML Model - Fraud payment method',
      description:
        'This is a model to detect overall fraud of the payment method',
      modelType: 'EXPLAINABLE',
      checksFor: ['Fraud'],
      enabled: true,
    },
    {
      id: 'ML-002',
      name: 'ML Model - Fraud credit card',
      description: 'This is a model to detect overall fraud of the credit card',
      modelType: 'EXPLAINABLE',
      checksFor: ['Credit card fraud'],
      enabled: true,
    },
    {
      id: 'ML-003',
      name: 'ML Model - Money laundering',
      description: 'This is a model to detect money laundering',
      modelType: 'EXPLAINABLE',
      checksFor: ['Money laundering'],
      enabled: true,
    },
    {
      id: 'ML-004',
      name: 'ML Model - multiple fraud payment methods',
      description:
        'This is a model to detect overall fraud of the payment method',
      modelType: 'NON_EXPLAINABLE',
      checksFor: ['Fraud', 'Credit card fraud'],
      enabled: true,
    },
  ]
}
