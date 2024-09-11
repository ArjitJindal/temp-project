import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'

export const demoRuleSimulation: SimulationBeaconJob = {
  createdAt: 1702397945484,
  jobId: '027295d6-f456-4c3a-9ef7-45c29c43dffe',
  createdBy: 'auth0|635f9aed8eca9c6258ce7f6e',
  internal: true,
  type: 'BEACON',
  defaultRuleInstance: {
    ruleRunMode: 'LIVE',
    ruleExecutionMode: 'SYNC',
    id: 'a25685ad',
    ruleId: 'R-2',
    casePriority: 'P2',
    parameters: {
      transactionAmountThreshold: {
        USD: 10000,
      },
    },
    action: 'SUSPEND',
    type: 'TRANSACTION',
    ruleNameAlias: 'Transaction amount too high',
    ruleDescriptionAlias: 'Transaction amount is >= x in USD or equivalent',
    filters: {},
    riskLevelParameters: {
      VERY_HIGH: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      HIGH: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      MEDIUM: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      LOW: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      VERY_LOW: {
        transactionAmountThreshold: {
          ADA: 1000,
          USD: 10000,
        },
      },
    },
    riskLevelActions: {
      VERY_HIGH: 'SUSPEND',
      HIGH: 'SUSPEND',
      MEDIUM: 'SUSPEND',
      LOW: 'SUSPEND',
      VERY_LOW: 'SUSPEND',
    },
    nature: 'AML',
    labels: [],
    status: 'ACTIVE',
    createdAt: 1685604282954,
    updatedAt: 1702397930039,
    runCount: 1848,
    hitCount: 1434,
    checklistTemplateId: 'bc2aec76-7a41-4c61-a042-03d3faffbd37',
    alertConfig: {},
    checksFor: ['Transaction amount'],
  },
  iterations: [
    {
      taskId: '128eeb29-b3a9-4707-bf62-37f87981edc6',
      parameters: {
        type: 'BEACON',
        name: 'Iteration 1',
        description: '',
        sampling: {
          transactionsCount: 10000,
        },
        ruleInstance: {
          ruleRunMode: 'LIVE',
          ruleExecutionMode: 'SYNC',
          id: 'a25685ad',
          ruleId: 'R-2',
          casePriority: 'P2',
          parameters: {
            transactionAmountThreshold: {
              USD: 10000,
            },
          },
          action: 'SUSPEND',
          type: 'TRANSACTION',
          ruleNameAlias: 'Transaction amount too high',
          ruleDescriptionAlias:
            'Transaction amount is >= x in USD or equivalent',
          filters: {},
          riskLevelParameters: {
            VERY_HIGH: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
            HIGH: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
            MEDIUM: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
            LOW: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
            VERY_LOW: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
          },
          riskLevelActions: {
            VERY_HIGH: 'FLAG',
            HIGH: 'FLAG',
            MEDIUM: 'FLAG',
            LOW: 'FLAG',
            VERY_LOW: 'FLAG',
          },
          nature: 'AML',
          labels: [],
          status: 'ACTIVE',
          createdAt: 1685604282954,
          updatedAt: 1702397930039,
          runCount: 1848,
          hitCount: 1434,
          checklistTemplateId: 'bc2aec76-7a41-4c61-a042-03d3faffbd37',
          alertConfig: {},
          checksFor: ['Transaction amount'],
        },
      },
      progress: 1,
      statistics: {
        current: {
          totalCases: 39,
          falsePositivesCases: 0,
          usersHit: 39,
          transactionsHit: 39,
        },
        simulated: {
          totalCases: 215,
          falsePositivesCases: 0,
          usersHit: 215,
          transactionsHit: 38,
        },
      },
      latestStatus: {
        status: 'SUCCESS',
        timestamp: 1702397946185,
      },
      statuses: [
        {
          status: 'PENDING',
          timestamp: 1702397945484,
        },
        {
          status: 'IN_PROGRESS',
          timestamp: 1702397945489,
        },
        {
          status: 'SUCCESS',
          timestamp: 1702397946185,
        },
      ],
      name: 'Iteration 1',
      description: '',
      type: 'BEACON',
      createdAt: 1702397945484,
    },
  ],
}
