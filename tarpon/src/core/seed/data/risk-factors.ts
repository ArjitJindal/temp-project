import { memoize } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { ID_PREFIXES } from './seeds'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'

export const riskFactors: () => RiskFactor[] = memoize(() => {
  const data: RiskFactor[] = [
    {
      id: `${ID_PREFIXES.RISK_FACTOR}001`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:d791adbe',
          entityKey: 'CONSUMER_USER:employmentStatus__SENDER',
        },
      ],
      defaultWeight: 0.49,
      defaultRiskScore: 75,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        75
      ),
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:d791adbe',
                  },
                  'UNEMPLOYED',
                ],
              },
            ],
          },
          riskScore: 75,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 75),
          weight: 0.49,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:d791adbe',
                  },
                  'SELF_EMPLOYED',
                ],
              },
            ],
          },
          riskScore: 20,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 20),
          weight: 0.42,
        },
      ],
      name: 'User employment status',
      description: 'Risk based on consumer employment status',
      type: 'CONSUMER_USER',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}002`,
      status: 'ACTIVE',
      logicAggregationVariables: [
        {
          key: 'agg:e926f545$1',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
          aggregationFunc: 'UNIQUE_VALUES',
          aggregationGroupByFieldKey: 'TRANSACTION:originUserId',
          baseCurrency: 'EUR',
          timeWindow: {
            start: {
              units: 1,
              granularity: 'year',
            },
            end: {
              units: 0,
              granularity: 'now',
            },
          },
          includeCurrentEntity: false,
        },
        {
          key: 'agg:e926f545$2',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
          aggregationFunc: 'UNIQUE_VALUES',
          aggregationGroupByFieldKey: 'TRANSACTION:originUserId',
          baseCurrency: 'EUR',
          timeWindow: {
            start: {
              units: 1,
              granularity: 'year',
            },
            end: {
              units: 0,
              granularity: 'now',
            },
          },
          includeCurrentEntity: false,
        },
      ],
      logicEntityVariables: [],
      defaultWeight: 0.4,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        75
      ),
      defaultRiskScore: 75,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                some: [
                  {
                    var: 'agg:e926f545$1',
                  },
                  {
                    in: [
                      {
                        var: '',
                      },
                      ['Gift', 'Wealth', 'Pension'],
                    ],
                  },
                ],
              },
            ],
          },
          riskScore: 75,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 75),
          weight: 0.37,
        },
        {
          logic: {
            and: [
              {
                some: [
                  {
                    var: 'agg:e926f545$1',
                  },
                  {
                    in: [
                      {
                        var: '',
                      },
                      ['Salary', 'Business'],
                    ],
                  },
                ],
              },
            ],
          },
          riskScore: 10,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 10),
          weight: 0.37,
        },
        {
          logic: {
            and: [
              {
                some: [
                  {
                    var: 'agg:e926f545$1',
                  },
                  {
                    in: [
                      {
                        var: '',
                      },
                      ['Interests', 'Dividends'],
                    ],
                  },
                ],
              },
            ],
          },
          riskScore: 20,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 20),
          weight: 0.37,
        },
      ],
      name: 'Source of funds',
      description: 'Risk based on source of funds',
      type: 'CONSUMER_USER',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}003`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:c94c208d',
          entityKey: 'CONSUMER_USER:ageYears__SENDER',
        },
      ],
      defaultWeight: 0.34,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        75
      ),
      defaultRiskScore: 75,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '<=': [
                  0,
                  {
                    var: 'entity:c94c208d',
                  },
                  9,
                ],
              },
            ],
          },
          riskScore: 75,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 75),
          weight: 0.3,
        },
        {
          logic: {
            and: [
              {
                '<=': [
                  10,
                  {
                    var: 'entity:c94c208d',
                  },
                  22,
                ],
              },
            ],
          },
          riskScore: 50,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 50),
          weight: 0.3,
        },
        {
          logic: {
            and: [
              {
                '<=': [
                  23,
                  {
                    var: 'entity:c94c208d',
                  },
                  50,
                ],
              },
            ],
          },
          riskScore: 10,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 10),
          weight: 0.4,
        },
        {
          logic: {
            and: [
              {
                '<=': [
                  51,
                  {
                    var: 'entity:c94c208d',
                  },
                  65,
                ],
              },
            ],
          },
          riskScore: 56.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            56.5
          ),
          weight: 0.4,
        },
        {
          logic: {
            and: [
              {
                '>': [
                  {
                    var: 'entity:c94c208d',
                  },
                  65,
                ],
              },
            ],
          },
          riskScore: 90,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 90),
          weight: 0.4,
        },
      ],
      name: 'Customer age',
      description: 'Risk based on customer age range (years)',
      type: 'CONSUMER_USER',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}004`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:5af59ba4',
          entityKey:
            'BUSINESS_USER:legalEntity-companyGeneralDetails-userRegistrationStatus__SENDER',
        },
      ],
      defaultWeight: 1,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        56.5
      ),
      defaultRiskScore: 56.5,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:5af59ba4',
                  },
                  'REGISTERED',
                ],
              },
            ],
          },
          riskScore: 10,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 10),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:5af59ba4',
                  },
                  'UNREGISTERED',
                ],
              },
            ],
          },
          riskScore: 75,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 75),
          weight: 1,
        },
      ],
      name: 'User registration status',
      description: 'Risk based on business user registration status',
      type: 'BUSINESS',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}005`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:f95602e2',
          entityKey:
            'BUSINESS_USER:legalEntity-companyGeneralDetails-businessIndustry__SENDER',
        },
      ],
      defaultWeight: 1,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        56.5
      ),
      defaultRiskScore: 56.5,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                all: [
                  {
                    var: 'entity:f95602e2',
                  },
                  {
                    in: [
                      {
                        var: '',
                      },
                      ['Information Technology', 'Artificial Intelligence'],
                    ],
                  },
                ],
              },
            ],
          },
          riskScore: 10,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 10),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                all: [
                  {
                    var: 'entity:f95602e2',
                  },
                  {
                    in: [
                      {
                        var: '',
                      },
                      ['Real Estate'],
                    ],
                  },
                ],
              },
            ],
          },
          riskScore: 56.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            56.5
          ),
          weight: 1,
        },
      ],
      name: 'Business industry',
      description:
        'Risk value based on the industry in which the business operates',
      type: 'BUSINESS',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}006`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:9ea5f44c',
          entityKey: 'TRANSACTION:originPaymentDetails-method',
        },
      ],
      defaultWeight: 1,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        10
      ),
      defaultRiskScore: 10,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                in: [
                  {
                    var: 'entity:9ea5f44c',
                  },
                  ['ACH', 'SWIFT'],
                ],
              },
            ],
          },
          riskScore: 10,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 10),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:9ea5f44c',
                  },
                  'CARD',
                ],
              },
            ],
          },
          riskScore: 6.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            6.5
          ),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:9ea5f44c',
                  },
                  'UPI',
                ],
              },
            ],
          },
          riskScore: 100,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            100
          ),
          weight: 1,
        },
      ],
      name: 'Origin payment method',
      description: 'Risk based on transaction origin payment method',
      type: 'TRANSACTION',
    } as RiskFactor,
    {
      id: `${ID_PREFIXES.RISK_FACTOR}007`,
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [
        {
          key: 'entity:8ba4632f',
          entityKey: 'TRANSACTION:time',
        },
      ],
      defaultWeight: 1,
      defaultRiskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        3
      ),
      defaultRiskScore: 3,
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                'op:between_time': [
                  {
                    var: 'entity:8ba4632f',
                  },
                  57600,
                  72000,
                ],
              },
            ],
          },
          riskScore: 56.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            56.5
          ),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                'op:between_time': [
                  {
                    var: 'entity:8ba4632f',
                  },
                  57600,
                  0,
                ],
              },
            ],
          },
          riskScore: 56.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            56.5
          ),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                'op:between_time': [
                  {
                    var: 'entity:8ba4632f',
                  },
                  57600,
                  28800,
                ],
              },
            ],
          },
          riskScore: 3,
          riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, 3),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                'op:between_time': [
                  {
                    var: 'entity:8ba4632f',
                  },
                  57600,
                  43200,
                ],
              },
            ],
          },
          riskScore: 6.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            6.5
          ),
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                'op:between_time': [
                  {
                    var: 'entity:8ba4632f',
                  },
                  43260,
                  57540,
                ],
              },
            ],
          },
          riskScore: 56.5,
          riskLevel: getRiskLevelFromScore(
            DEFAULT_CLASSIFICATION_SETTINGS,
            56.5
          ),
          weight: 1,
        },
      ],
      name: 'Transaction time',
      description: 'Risk value based on time of transaction',
      type: 'TRANSACTION',
    } as RiskFactor,
  ]

  return data
})
