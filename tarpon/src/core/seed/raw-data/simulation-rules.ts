import { getRandomUser } from '../samplers/accounts'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'

export const getRuleSimulation = (): Array<
  SimulationBeaconJob & { _id: string }
> => [
  {
    _id: '7a6d4861-d761-46d6-9a37-263ff4066419',
    createdAt: 1691483599102,
    jobId: '7a6d4861-d761-46d6-9a37-263ff4066419',
    createdBy: getRandomUser().assigneeUserId,
    type: 'BEACON',
    defaultRuleInstance: {
      id: '2b9ec5b2',
      mode: 'LIVE_SYNC',
      ruleId: 'R-2',
      checksFor: ['Transaction amount'],
      casePriority: 'P1',
      parameters: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      action: 'FLAG',
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
      createdAt: 1687275644581,
      updatedAt: 1687463461087,
      runCount: 15,
      hitCount: 3,
    },
    iterations: [
      {
        taskId: 'ebaffea0-7fbd-4aec-bdd4-4e772e437ea3',
        parameters: {
          type: 'BEACON',
          name: 'Iteration 1',
          description: '',
          sampling: {
            transactionsCount: 10000,
          },
          ruleInstance: {
            mode: 'LIVE_SYNC',
            id: '2b9ec5b2',
            ruleId: 'R-2',
            checksFor: ['Transaction amount'],
            casePriority: 'P1',
            parameters: {
              transactionAmountThreshold: {
                USD: 10000,
              },
            },
            action: 'FLAG',
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
            createdAt: 1687275644581,
            updatedAt: 1687463461087,
            runCount: 15,
            hitCount: 3,
          },
        },
        progress: 1,
        statistics: {
          current: {
            totalCases: 5,
            falsePositivesCases: 1,
            usersHit: 5,
            transactionsHit: 3,
          },
          simulated: {
            totalCases: 1929,
            falsePositivesCases: 1,
            usersHit: 1929,
            transactionsHit: 2843,
          },
        },
        latestStatus: {
          status: 'SUCCESS',
          timestamp: 1691483720317,
        },
        statuses: [
          {
            status: 'PENDING',
            timestamp: 1691483599103,
          },
          {
            status: 'IN_PROGRESS',
            timestamp: 1691483609047,
          },
          {
            status: 'SUCCESS',
            timestamp: 1691483720317,
          },
        ],
        name: 'Iteration 1',
        description: '',
        type: 'BEACON',
        createdAt: 1691483599103,
      },
    ],
  },
  {
    _id: '80ba00a4-3bfe-4d20-b9f2-05de8482bc8f',
    createdAt: 1691441270921,
    jobId: '80ba00a4-3bfe-4d20-b9f2-05de8482bc8f',
    createdBy: getRandomUser().assigneeUserId,
    type: 'BEACON',
    defaultRuleInstance: {
      mode: 'LIVE_SYNC',
      id: '0afc5eba',
      ruleId: 'R-1',
      casePriority: 'P1',
      checksFor: ['1st transaction'],
      parameters: {},
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'First payment of a Customer',
      ruleDescriptionAlias: 'First outgoing transaction of a user',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
        VERY_LOW: {},
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
      createdAt: 1687763261362,
      updatedAt: 1688736711752,
      runCount: 13,
      hitCount: 3,
    },
    iterations: [
      {
        taskId: '5edb1cdd-5df4-4bcc-bb13-a860979d17ac',
        parameters: {
          type: 'BEACON',
          name: 'Iteration 1',
          description: '',
          sampling: {
            transactionsCount: 10000,
          },
          ruleInstance: {
            mode: 'LIVE_SYNC',
            id: '0afc5eba',
            ruleId: 'R-1',
            checksFor: ['1st transaction'],
            casePriority: 'P1',
            parameters: {},
            action: 'FLAG',
            type: 'TRANSACTION',
            ruleNameAlias: 'First payment of a Customer',
            ruleDescriptionAlias: 'First outgoing transaction of a user',
            filters: {},
            riskLevelParameters: {
              VERY_HIGH: {},
              HIGH: {},
              MEDIUM: {},
              LOW: {},
              VERY_LOW: {},
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
            createdAt: 1687763261362,
            updatedAt: 1688736711752,
            runCount: 13,
            hitCount: 3,
          },
        },
        progress: 1,
        statistics: {
          current: {
            totalCases: 3,
            falsePositivesCases: 1,
            usersHit: 3,
            transactionsHit: 3,
          },
          simulated: {
            totalCases: 0,
            falsePositivesCases: 0,
            usersHit: 0,
            transactionsHit: 0,
          },
        },
        latestStatus: {
          status: 'SUCCESS',
          timestamp: 1691441392175,
        },
        statuses: [
          {
            status: 'PENDING',
            timestamp: 1691441270921,
          },
          {
            status: 'IN_PROGRESS',
            timestamp: 1691441280490,
          },
          {
            status: 'SUCCESS',
            timestamp: 1691441392175,
          },
        ],
        name: 'Iteration 1',
        description: '',
        type: 'BEACON',
        createdAt: 1691441270921,
      },
    ],
  },
  {
    _id: '95c2ae52-1476-4df7-88e4-768c3c7e3373',
    createdAt: 1691440136730,
    jobId: '95c2ae52-1476-4df7-88e4-768c3c7e3373',
    createdBy: getRandomUser().assigneeUserId,
    type: 'BEACON',
    defaultRuleInstance: {
      mode: 'LIVE_SYNC',
      id: 'a86206ad',
      ruleId: 'R-1',
      checksFor: ['1st transaction'],
      casePriority: 'P1',
      parameters: {},
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'First payment of a Customer',
      ruleDescriptionAlias: 'First outgoing transaction of a user',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
        VERY_LOW: {},
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
      createdAt: 1684141463422,
      updatedAt: 1687463460316,
      runCount: 17,
      hitCount: 5,
    },
    iterations: [
      {
        taskId: '33ca7568-6f04-4455-a54c-81e649983b7d',
        parameters: {
          type: 'BEACON',
          name: 'Iteration 1',
          description: '',
          sampling: {
            transactionsCount: 10000,
          },
          ruleInstance: {
            mode: 'LIVE_SYNC',
            id: 'a86206ad',
            ruleId: 'R-1',
            checksFor: ['1st transaction'],
            casePriority: 'P1',
            parameters: {},
            action: 'FLAG',
            type: 'TRANSACTION',
            ruleNameAlias: 'First payment of a Customer',
            ruleDescriptionAlias: 'First outgoing transaction of a user',
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
              VERY_HIGH: 'SUSPEND',
              HIGH: 'SUSPEND',
              MEDIUM: 'SUSPEND',
              LOW: 'SUSPEND',
              VERY_LOW: 'SUSPEND',
            },
            nature: 'AML',
            labels: [],
            status: 'ACTIVE',
            createdAt: 1684141463422,
            updatedAt: 1687463460316,
            runCount: 17,
            hitCount: 5,
          },
        },
        progress: 1,
        statistics: {
          current: {
            totalCases: 5,
            falsePositivesCases: 1,
            usersHit: 5,
            transactionsHit: 5,
          },
          simulated: {
            totalCases: 0,
            falsePositivesCases: 0,
            usersHit: 0,
            transactionsHit: 0,
          },
        },
        latestStatus: {
          status: 'SUCCESS',
          timestamp: 1691440259162,
        },
        statuses: [
          {
            status: 'PENDING',
            timestamp: 1691440136730,
          },
          {
            status: 'IN_PROGRESS',
            timestamp: 1691440146224,
          },
          {
            status: 'SUCCESS',
            timestamp: 1691440259162,
          },
        ],
        name: 'Iteration 1',
        description: '',
        type: 'BEACON',
        createdAt: 1691440136730,
      },
      {
        taskId: '351614a6-eb38-4ba3-ace7-dc9e0d63ffb0',
        parameters: {
          type: 'BEACON',
          name: 'Iteration 1',
          description: '',
          sampling: {
            transactionsCount: 10000,
          },
          ruleInstance: {
            mode: 'LIVE_SYNC',
            id: 'a86206ad',
            ruleId: 'R-1',
            checksFor: ['1st transaction'],
            casePriority: 'P1',
            parameters: {},
            action: 'FLAG',
            type: 'TRANSACTION',
            ruleNameAlias: 'First payment of a Customer',
            ruleDescriptionAlias: 'First outgoing transaction of a user',
            filters: {},
            riskLevelParameters: {
              VERY_HIGH: {},
              HIGH: {},
              MEDIUM: {},
              LOW: {},
              VERY_LOW: {},
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
            createdAt: 1684141463422,
            updatedAt: 1687463460316,
            runCount: 17,
            hitCount: 5,
          },
        },
        progress: 1,
        statistics: {
          current: {
            totalCases: 5,
            falsePositivesCases: 1,
            usersHit: 5,
            transactionsHit: 5,
          },
          simulated: {
            totalCases: 0,
            falsePositivesCases: 0,
            usersHit: 0,
            transactionsHit: 0,
          },
        },
        latestStatus: {
          status: 'SUCCESS',
          timestamp: 1691440264476,
        },
        statuses: [
          {
            status: 'PENDING',
            timestamp: 1691440136730,
          },
          {
            status: 'IN_PROGRESS',
            timestamp: 1691440146365,
          },
          {
            status: 'SUCCESS',
            timestamp: 1691440264476,
          },
        ],
        name: 'Iteration 1',
        description: '',
        type: 'BEACON',
        createdAt: 1691440136730,
      },
      {
        taskId: 'b4ba9cda-1c4a-4914-a720-915462239252',
        parameters: {
          type: 'BEACON',
          name: 'Iteration 1',
          description: '',
          sampling: {
            transactionsCount: 10000,
          },
          ruleInstance: {
            mode: 'LIVE_SYNC',
            id: 'a86206ad',
            ruleId: 'R-1',
            checksFor: ['1st transaction'],
            casePriority: 'P1',
            parameters: {},
            action: 'FLAG',
            type: 'TRANSACTION',
            ruleNameAlias: 'First payment of a Customer',
            ruleDescriptionAlias: 'First outgoing transaction of a user',
            filters: {},
            riskLevelParameters: {
              VERY_HIGH: {},
              HIGH: {},
              MEDIUM: {},
              LOW: {},
              VERY_LOW: {},
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
            createdAt: 1684141463422,
            updatedAt: 1687463460316,
            runCount: 17,
            hitCount: 5,
          },
        },
        progress: 1,
        statistics: {
          current: {
            totalCases: 5,
            falsePositivesCases: 1,
            usersHit: 5,
            transactionsHit: 5,
          },
          simulated: {
            totalCases: 0,
            falsePositivesCases: 0,
            usersHit: 0,
            transactionsHit: 0,
          },
        },
        latestStatus: {
          status: 'SUCCESS',
          timestamp: 1691440256354,
        },
        statuses: [
          {
            status: 'PENDING',
            timestamp: 1691440136730,
          },
          {
            status: 'IN_PROGRESS',
            timestamp: 1691440146403,
          },
          {
            status: 'SUCCESS',
            timestamp: 1691440256354,
          },
        ],
        name: 'Iteration 1',
        description: '',
        type: 'BEACON',
        createdAt: 1691440136730,
      },
    ],
  },
]
