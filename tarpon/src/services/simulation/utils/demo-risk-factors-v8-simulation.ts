import { SimulationV8RiskFactorsJob } from '@/@types/openapi-internal/SimulationV8RiskFactorsJob'

export const demoRiskFactorsV8Simulation: SimulationV8RiskFactorsJob = {
  createdAt: 1741710269555,
  jobId: 'e6317a01-c69a-4425-b124-f0cc23e7d6f3',
  createdBy: 'auth0|66f2d7d4097e0006f28b7490',
  internal: true,
  type: 'RISK_FACTORS_V8',
  iterations: [
    {
      taskId: '4a5f36ee-23bf-44b6-93bc-c5f75d5b5db4',
      parameters: {
        type: 'RISK_FACTORS_V8',
        parameters: [
          {
            id: 'RF-001',
            createdAt: 1740661016064,
            updatedAt: 1740661016064,
            status: 'ACTIVE',
            logicAggregationVariables: [],
            logicEntityVariables: [
              {
                key: 'entity:d791adbe',
                entityKey: 'CONSUMER_USER:employmentStatus__SENDER',
              },
            ],
            defaultWeight: 0.49,
            defaultRiskLevel: 'HIGH',
            defaultRiskScore: 75,
            riskLevelLogic: [
              {
                logic: {
                  and: [{ '==': [{ var: 'entity:d791adbe' }, 'UNEMPLOYED'] }],
                },
                riskScore: 75,
                riskLevel: 'HIGH',
                weight: 0.49,
              },
              {
                logic: {
                  and: [
                    { '==': [{ var: 'entity:d791adbe' }, 'SELF_EMPLOYED'] },
                  ],
                },
                riskScore: 20,
                riskLevel: 'LOW',
                weight: 0.42,
              },
            ],
            name: 'User employment status',
            description: 'Risk based on consumer employment status',
            type: 'CONSUMER_USER',
          },
          {
            id: 'RF-002',
            createdAt: 1740661016068,
            updatedAt: 1740661016068,
            status: 'ACTIVE',
            logicAggregationVariables: [
              {
                key: 'agg:e926f545$1',
                type: 'USER_TRANSACTIONS',
                userDirection: 'SENDER',
                transactionDirection: 'SENDING',
                aggregationFieldKey:
                  'TRANSACTION:originFundsInfo-sourceOfFunds',
                aggregationFunc: 'UNIQUE_VALUES',
                aggregationGroupByFieldKey: 'TRANSACTION:originUserId',
                baseCurrency: 'EUR',
                timeWindow: {
                  start: { units: 1, granularity: 'year' },
                  end: { units: 0, granularity: 'now' },
                },
                version: 1738852124411,
                includeCurrentEntity: false,
              },
              {
                key: 'agg:e926f545$2',
                type: 'USER_TRANSACTIONS',
                userDirection: 'SENDER',
                transactionDirection: 'SENDING',
                aggregationFieldKey:
                  'TRANSACTION:originFundsInfo-sourceOfFunds',
                aggregationFunc: 'UNIQUE_VALUES',
                aggregationGroupByFieldKey: 'TRANSACTION:originUserId',
                baseCurrency: 'EUR',
                timeWindow: {
                  start: { units: 1, granularity: 'year' },
                  end: { units: 0, granularity: 'now' },
                },
                version: 1738852124411,
                includeCurrentEntity: false,
              },
            ],
            logicEntityVariables: [],
            defaultWeight: 0.4,
            defaultRiskLevel: 'HIGH',
            defaultRiskScore: 75,
            riskLevelLogic: [
              {
                logic: {
                  and: [
                    {
                      some: [
                        { var: 'agg:e926f545$1' },
                        { in: [{ var: '' }, ['Gift', 'Wealth', 'Pension']] },
                      ],
                    },
                  ],
                },
                riskScore: 75,
                riskLevel: 'HIGH',
                weight: 0.37,
              },
              {
                logic: {
                  and: [
                    {
                      some: [
                        { var: 'agg:e926f545$1' },
                        { in: [{ var: '' }, ['Salary', 'Business']] },
                      ],
                    },
                  ],
                },
                riskScore: 10,
                riskLevel: 'VERY_LOW',
                weight: 0.37,
              },
              {
                logic: {
                  and: [
                    {
                      some: [
                        { var: 'agg:e926f545$1' },
                        { in: [{ var: '' }, ['Interests', 'Dividends']] },
                      ],
                    },
                  ],
                },
                riskScore: 20,
                riskLevel: 'LOW',
                weight: 0.37,
              },
            ],
            name: 'Source of funds',
            description: 'Risk based on source of funds',
            type: 'CONSUMER_USER',
          },
          {
            id: 'RF-003',
            createdAt: 1740661016084,
            updatedAt: 1740661016084,
            status: 'ACTIVE',
            logicAggregationVariables: [],
            logicEntityVariables: [
              {
                key: 'entity:c94c208d',
                entityKey: 'CONSUMER_USER:ageYears__SENDER',
              },
            ],
            defaultWeight: 0.34,
            defaultRiskLevel: 'HIGH',
            defaultRiskScore: 75,
            riskLevelLogic: [
              {
                logic: { and: [{ '<=': [0, { var: 'entity:c94c208d' }, 9] }] },
                riskScore: 75,
                riskLevel: 'HIGH',
                weight: 0.3,
              },
              {
                logic: {
                  and: [{ '<=': [10, { var: 'entity:c94c208d' }, 22] }],
                },
                riskScore: 50,
                riskLevel: 'MEDIUM',
                weight: 0.3,
              },
              {
                logic: {
                  and: [{ '<=': [23, { var: 'entity:c94c208d' }, 50] }],
                },
                riskScore: 10,
                riskLevel: 'VERY_LOW',
                weight: 0.4,
              },
              {
                logic: {
                  and: [{ '<=': [51, { var: 'entity:c94c208d' }, 65] }],
                },
                riskScore: 56.5,
                riskLevel: 'MEDIUM',
                weight: 0.4,
              },
              {
                logic: { and: [{ '>': [{ var: 'entity:c94c208d' }, 65] }] },
                riskScore: 90,
                riskLevel: 'VERY_HIGH',
                weight: 0.4,
              },
            ],
            name: 'Customer age',
            description: 'Risk based on customer age range (years)',
            type: 'CONSUMER_USER',
          },
          {
            id: 'RF-004',
            createdAt: 1740661016091,
            updatedAt: 1740661016091,
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
            defaultRiskLevel: 'MEDIUM',
            defaultRiskScore: 56.5,
            riskLevelLogic: [
              {
                logic: {
                  and: [{ '==': [{ var: 'entity:5af59ba4' }, 'REGISTERED'] }],
                },
                riskScore: 10,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: {
                  and: [{ '==': [{ var: 'entity:5af59ba4' }, 'UNREGISTERED'] }],
                },
                riskScore: 75,
                riskLevel: 'HIGH',
                weight: 1,
              },
            ],
            name: 'User registration status',
            description: 'Risk based on business user registration status',
            type: 'BUSINESS',
          },
          {
            id: 'RF-005',
            createdAt: 1740661016098,
            updatedAt: 1740661016098,
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
            defaultRiskLevel: 'MEDIUM',
            defaultRiskScore: 56.5,
            riskLevelLogic: [
              {
                logic: {
                  and: [
                    {
                      all: [
                        { var: 'entity:f95602e2' },
                        {
                          in: [
                            { var: '' },
                            [
                              'Information Technology',
                              'Artificial Intelligence',
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                },
                riskScore: 10,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: {
                  and: [
                    {
                      all: [
                        { var: 'entity:f95602e2' },
                        { in: [{ var: '' }, ['Real Estate']] },
                      ],
                    },
                  ],
                },
                riskScore: 56.5,
                riskLevel: 'MEDIUM',
                weight: 1,
              },
            ],
            name: 'Business industry',
            description:
              'Risk value based on the industry in which the business operates',
            type: 'BUSINESS',
          },
          {
            id: 'RF-006',
            createdAt: 1740661016102,
            updatedAt: 1740661016102,
            status: 'ACTIVE',
            logicAggregationVariables: [],
            logicEntityVariables: [
              {
                key: 'entity:9ea5f44c',
                entityKey: 'TRANSACTION:originPaymentDetails-method',
              },
            ],
            defaultWeight: 1,
            defaultRiskLevel: 'VERY_LOW',
            defaultRiskScore: 10,
            riskLevelLogic: [
              {
                logic: {
                  and: [{ in: [{ var: 'entity:9ea5f44c' }, ['ACH', 'SWIFT']] }],
                },
                riskScore: 10,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: {
                  and: [{ '==': [{ var: 'entity:9ea5f44c' }, 'CARD'] }],
                },
                riskScore: 6.5,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: { and: [{ '==': [{ var: 'entity:9ea5f44c' }, 'UPI'] }] },
                riskScore: 100,
                riskLevel: 'VERY_HIGH',
                weight: 1,
              },
            ],
            name: 'Origin payment method',
            description: 'Risk based on transaction origin payment method',
            type: 'TRANSACTION',
          },
          {
            id: 'RF-007',
            createdAt: 1740661016105,
            updatedAt: 1740661016105,
            status: 'ACTIVE',
            logicAggregationVariables: [],
            logicEntityVariables: [
              { key: 'entity:8ba4632f', entityKey: 'TRANSACTION:time' },
            ],
            defaultWeight: 1,
            defaultRiskLevel: 'VERY_LOW',
            defaultRiskScore: 3,
            riskLevelLogic: [
              {
                logic: {
                  and: [
                    {
                      'op:between_time': [
                        { var: 'entity:8ba4632f' },
                        57600,
                        72000,
                      ],
                    },
                  ],
                },
                riskScore: 56.5,
                riskLevel: 'MEDIUM',
                weight: 1,
              },
              {
                logic: {
                  and: [
                    {
                      'op:between_time': [{ var: 'entity:8ba4632f' }, 57600, 0],
                    },
                  ],
                },
                riskScore: 56.5,
                riskLevel: 'MEDIUM',
                weight: 1,
              },
              {
                logic: {
                  and: [
                    {
                      'op:between_time': [
                        { var: 'entity:8ba4632f' },
                        57600,
                        28800,
                      ],
                    },
                  ],
                },
                riskScore: 3,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: {
                  and: [
                    {
                      'op:between_time': [
                        { var: 'entity:8ba4632f' },
                        57600,
                        43200,
                      ],
                    },
                  ],
                },
                riskScore: 6.5,
                riskLevel: 'VERY_LOW',
                weight: 1,
              },
              {
                logic: {
                  and: [
                    {
                      'op:between_time': [
                        { var: 'entity:8ba4632f' },
                        43260,
                        57540,
                      ],
                    },
                  ],
                },
                riskScore: 56.5,
                riskLevel: 'MEDIUM',
                weight: 1,
              },
            ],
            name: 'Transaction time',
            description: 'Risk value based on time of transaction',
            type: 'TRANSACTION',
          },
        ],
        name: 'Iteration 1',
        description: '',
      },
      progress: 1,
      statistics: {
        current: [
          { count: 72, riskLevel: 'LOW', riskType: 'KRS' },
          { count: 123, riskLevel: 'MEDIUM', riskType: 'KRS' },
          { count: 68, riskLevel: 'HIGH', riskType: 'KRS' },
          { count: 4, riskLevel: 'VERY_HIGH', riskType: 'KRS' },
          { count: 9, riskLevel: 'VERY_LOW', riskType: 'KRS' },
          { count: 66, riskLevel: 'LOW', riskType: 'DRS' },
          { count: 137, riskLevel: 'MEDIUM', riskType: 'DRS' },
          { count: 66, riskLevel: 'HIGH', riskType: 'DRS' },
          { count: 4, riskLevel: 'VERY_HIGH', riskType: 'DRS' },
          { count: 3, riskLevel: 'VERY_LOW', riskType: 'DRS' },
          { count: 122, riskLevel: 'LOW', riskType: 'ARS' },
          { count: 98, riskLevel: 'MEDIUM', riskType: 'ARS' },
          { count: 82, riskLevel: 'HIGH', riskType: 'ARS' },
          { count: 102, riskLevel: 'VERY_HIGH', riskType: 'ARS' },
          { count: 96, riskLevel: 'VERY_LOW', riskType: 'ARS' },
        ],
        simulated: [
          { count: 41, riskLevel: 'LOW', riskType: 'KRS' },
          { count: 69, riskLevel: 'MEDIUM', riskType: 'KRS' },
          { count: 165, riskLevel: 'HIGH', riskType: 'KRS' },
          { count: 0, riskLevel: 'VERY_HIGH', riskType: 'KRS' },
          { count: 1, riskLevel: 'VERY_LOW', riskType: 'KRS' },
          { count: 80, riskLevel: 'LOW', riskType: 'DRS' },
          { count: 183, riskLevel: 'MEDIUM', riskType: 'DRS' },
          { count: 12, riskLevel: 'HIGH', riskType: 'DRS' },
          { count: 0, riskLevel: 'VERY_HIGH', riskType: 'DRS' },
          { count: 1, riskLevel: 'VERY_LOW', riskType: 'DRS' },
          { count: 213, riskLevel: 'LOW', riskType: 'ARS' },
          { count: 36, riskLevel: 'MEDIUM', riskType: 'ARS' },
          { count: 29, riskLevel: 'HIGH', riskType: 'ARS' },
          { count: 0, riskLevel: 'VERY_HIGH', riskType: 'ARS' },
          { count: 222, riskLevel: 'VERY_LOW', riskType: 'ARS' },
        ],
      },
      latestStatus: { status: 'SUCCESS', timestamp: 1741710271716 },
      statuses: [
        { status: 'PENDING', timestamp: 1741710269555 },
        { status: 'IN_PROGRESS', timestamp: 1741710271716 },
        { status: 'SUCCESS', timestamp: 1741710271716 },
      ],
      name: 'Iteration 1',
      description: '',
      type: 'RISK_FACTORS_V8',
      createdAt: 1741710269555,
      totalEntities: 276,
    },
  ],
}
