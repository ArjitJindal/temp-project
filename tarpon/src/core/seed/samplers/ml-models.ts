import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModelsSample = (): RuleMLModel[] => {
  return [
    {
      id: 'ML-001',
      name: 'Unusual Transaction Frequency',
      description:
        'Detects abnormal frequency patterns indicative of suspicious behavior.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Behavioral Change'],
      enabled: true,
    },
    {
      id: 'ML-002',
      name: 'Anonymous High-Risk Transfers',
      description:
        'Evaluates anonymous transaction profiles for high-risk behavior.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Anonymity Risk'],
      enabled: true,
    },
    {
      id: 'ML-003',
      name: 'Account Takeover Detection',
      description:
        'Identifies unusual login and transaction activities signaling takeover.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Account Takeover'],
      enabled: true,
    },
    {
      id: 'ML-004',
      name: 'High-Value Structuring Activity',
      description: 'Flags structuring transactions below reporting thresholds.',
      modelType: 'NON_EXPLAINABLE',
      checksFor: ['Structuring'],
      enabled: true,
    },
    {
      id: 'ML-005',
      name: 'Merchant Profile Change',
      description:
        'Monitors sudden merchant profile changes indicating increased risk.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Behavioral Change'],
      enabled: true,
    },
    {
      id: 'ML-006',
      name: 'Cross-border Risk Transactions',
      description:
        'Monitors cross-border activities involving high-risk jurisdictions.',
      modelType: 'EXPLAINABLE',
      checksFor: ['Cross-border Transaction'],
      enabled: true,
    },
  ]
}
