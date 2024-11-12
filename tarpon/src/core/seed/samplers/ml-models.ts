import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModelsSample = (): RuleMLModel[] => {
  return [
    {
      id: 'ML-001',
      name: 'Fraud (Generic)',
      description:
        'Detects fraud with a generic model across all payment methods and jurisdictions with an umbrella approach.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Fraud'],
      enabled: true,
    },
    {
      id: 'ML-002',
      name: 'Fraud credit card',
      description: 'Focuses on credit card fraud risks specifically.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Credit card fraud'],
      enabled: true,
    },
    {
      id: 'ML-003',
      name: 'Money laundering',
      description:
        'Checks for money laundering-related risks, specifically structuring and money mules.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Money laundering'],
      enabled: true,
    },
    {
      id: 'ML-004',
      name: 'Bank transfer',
      description:
        'Detects fraud on bank transfers specifically focusing on potential social engineering, account takeover, or authorized push payment fraud.',
      modelType: 'NON_EXPLAINABLE',
      checksFor: ['Fraud', 'Bank Fraud'],
      enabled: true,
    },
    {
      id: 'ML-005',
      name: 'Unexpected transactional behavior',
      description:
        'Detects behavior change of a user based on transaction attributes such as IP address, amount, time of transaction, location of the transaction, a new beneficiary account and so forth.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Fraud', 'Behavioral Change'],
      enabled: true,
    },
  ]
}
