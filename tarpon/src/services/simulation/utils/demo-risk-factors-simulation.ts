import { SimulationRiskFactorsJob } from '@/@types/openapi-internal/SimulationRiskFactorsJob'

export const demoRiskFactorsSimulation: SimulationRiskFactorsJob = {
  createdAt: 1741720780163,
  jobId: '419c322e-9b6f-4fee-a1e2-e623d223416c',
  createdBy: 'auth0|635f9c7876d6e7d8d8568c4c',
  internal: true,
  type: 'RISK_FACTORS',
  defaultParameterRiskValues: [],
  iterations: [
    {
      taskId: '44fddbfa-541b-49fb-8e7f-3dbe9732b2cf',
      parameters: {
        type: 'RISK_FACTORS',
        parameterAttributeRiskValues: [
          {
            parameter: 'type',
            isActive: true,
            isDerived: true,
            riskEntityType: 'CONSUMER_USER',
            riskLevelAssignmentValues: [
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [{ kind: 'LITERAL', content: 'CONSUMER' }],
                  },
                },
                riskValue: { type: 'RISK_SCORE', value: 90.998 },
              },
            ],
            parameterType: 'VARIABLE',
            weight: 0.59,
            defaultValue: { type: 'RISK_SCORE', value: 90.99 },
          },
          {
            parameter: 'userDetails.countryOfNationality',
            isActive: false,
            isDerived: false,
            riskEntityType: 'CONSUMER_USER',
            riskLevelAssignmentValues: [
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AF' },
                      { kind: 'LITERAL', content: 'BY' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_SCORE', value: 90 },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AX' },
                      { kind: 'LITERAL', content: 'AS' },
                      { kind: 'LITERAL', content: 'AD' },
                      { kind: 'LITERAL', content: 'BW' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_SCORE', value: 70 },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AQ' },
                      { kind: 'LITERAL', content: 'AR' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_SCORE', value: 30 },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AL' },
                      { kind: 'LITERAL', content: 'DZ' },
                      { kind: 'LITERAL', content: 'BS' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_SCORE', value: 50.77 },
              },
            ],
            parameterType: 'VARIABLE',
            weight: 1,
            defaultValue: { type: 'RISK_SCORE', value: 75 },
          },
          {
            parameter: 'userDetails.countryOfResidence',
            isActive: true,
            isDerived: false,
            riskEntityType: 'CONSUMER_USER',
            riskLevelAssignmentValues: [
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AF' },
                      { kind: 'LITERAL', content: 'KP' },
                      { kind: 'LITERAL', content: 'RU' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'VERY_HIGH' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'BY' },
                      { kind: 'LITERAL', content: 'LY' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'HIGH' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AD' },
                      { kind: 'LITERAL', content: 'AW' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'LOW' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AS' },
                      { kind: 'LITERAL', content: 'AI' },
                      { kind: 'LITERAL', content: 'BB' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'MEDIUM' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'FR' },
                      { kind: 'LITERAL', content: 'IS' },
                      { kind: 'LITERAL', content: 'LU' },
                      { kind: 'LITERAL', content: 'NO' },
                      { kind: 'LITERAL', content: 'SE' },
                      { kind: 'LITERAL', content: 'DK' },
                      { kind: 'LITERAL', content: 'NZ' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'VERY_LOW' },
              },
            ],
            parameterType: 'VARIABLE',
            weight: 1,
            defaultValue: { type: 'RISK_SCORE', value: 90 },
          },
          {
            parameter: 'destinationAmountDetails.country',
            isActive: false,
            isDerived: false,
            riskEntityType: 'TRANSACTION',
            riskLevelAssignmentValues: [
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AF' },
                      { kind: 'LITERAL', content: 'BY' },
                      { kind: 'LITERAL', content: 'KP' },
                      { kind: 'LITERAL', content: 'LY' },
                      { kind: 'LITERAL', content: 'RU' },
                      { kind: 'LITERAL', content: 'SY' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'VERY_HIGH' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AX' },
                      { kind: 'LITERAL', content: 'AS' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'HIGH' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AQ' },
                      { kind: 'LITERAL', content: 'AR' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'LOW' },
              },
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [
                      { kind: 'LITERAL', content: 'AL' },
                      { kind: 'LITERAL', content: 'DZ' },
                      { kind: 'LITERAL', content: 'AO' },
                    ],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'MEDIUM' },
              },
            ],
            parameterType: 'VARIABLE',
            weight: 1,
            defaultValue: { type: 'RISK_LEVEL', value: 'VERY_HIGH' },
          },
          {
            parameter: 'originPaymentDetails.method',
            isActive: true,
            isDerived: false,
            riskEntityType: 'TRANSACTION',
            riskLevelAssignmentValues: [
              {
                parameterValue: {
                  content: {
                    kind: 'MULTIPLE',
                    values: [{ kind: 'LITERAL', content: 'UPI' }],
                  },
                },
                riskValue: { type: 'RISK_LEVEL', value: 'LOW' },
              },
            ],
            parameterType: 'VARIABLE',
            weight: 1,
            defaultValue: { type: 'RISK_LEVEL', value: 'VERY_HIGH' },
          },
        ],
        name: 'Iteration 1',
        description: '',
      },
      progress: 1,
      statistics: {
        current: [
          { count: 62, riskLevel: 'LOW', riskType: 'KRS' },
          { count: 145, riskLevel: 'MEDIUM', riskType: 'KRS' },
        ],
        simulated: [
          { count: 0, riskLevel: 'LOW', riskType: 'KRS' },
          { count: 74, riskLevel: 'MEDIUM', riskType: 'KRS' },
          { count: 113, riskLevel: 'HIGH', riskType: 'KRS' },
        ],
      },
      latestStatus: { status: 'SUCCESS', timestamp: 1741720802970 },
      statuses: [
        { status: 'PENDING', timestamp: 1741720780163 },
        { status: 'IN_PROGRESS', timestamp: 1741720802970 },
        { status: 'SUCCESS', timestamp: 1741720802970 },
      ],
      name: 'Iteration 1',
      description: '',
      type: 'RISK_FACTORS',
      createdAt: 1741720780163,
      totalEntities: 4276,
    },
  ],
}
