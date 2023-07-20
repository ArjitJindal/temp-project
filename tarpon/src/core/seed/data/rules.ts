import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { sampleGuid } from '@/core/seed/samplers/id'
import { randomArray } from '@/utils/prng'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const rules: ExecutedRulesResult[] = [
  {
    ruleName: 'First payment of a Customer    ',
    ruleAction: 'FLAG',
    ruleId: 'R-1',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'First transaction of a user',
    ruleHit: true,
  },
  {
    ruleName: 'Transaction amount too high',
    ruleAction: 'FLAG',
    ruleId: 'R-2',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.2),
    ruleDescription: 'Transaction amount is >= x in USD or equivalent',
    ruleHit: true,
  },
  {
    ruleName: 'Unexpected origin or destination country',
    ruleAction: 'FLAG',
    ruleId: 'R-3',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.3),
    ruleDescription:
      'Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.',
    ruleHit: true,
  },
  {
    ruleName: 'Unexpected origin or destination currency',
    ruleAction: 'BLOCK',
    ruleId: 'R-4',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.4),
    ruleDescription:
      'Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.',
    ruleHit: true,
  },
  {
    ruleName: 'High velocity user',
    ruleAction: 'FLAG',
    ruleId: 'R-30',
    nature: 'FRAUD',
    ruleInstanceId: sampleGuid(0.5),
    ruleDescription: 'If a user makes >= x transactions within time t',
    ruleHit: true,
  },
  {
    ruleName: 'Same user using too many cards',
    ruleAction: 'FLAG',
    ruleId: 'R-54',
    nature: 'FRAUD',
    ruleInstanceId: sampleGuid(0.6),
    ruleDescription:
      'Same user using >= x unique cards counted by card fingerprint id',
    ruleHit: true,
  },
  {
    ruleName: 'Customer money flow is above the expected volume',
    ruleAction: 'FLAG',
    ruleId: 'R-69',
    nature: 'FRAUD',
    ruleInstanceId: sampleGuid(0.7),
    ruleDescription:
      'Customer is spending/receiving much more money than expected',
    ruleHit: true,
  },
  {
    ruleName: 'Currency transaction report needed',
    ruleAction: 'SUSPEND',
    ruleId: 'R-75',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.8),
    ruleDescription:
      'If a transaction amount is more than x - a "CTR" is required by law. x depends on jurisdiction. EU is 10,000 euro; US is 10,000 USD',
    ruleHit: true,
  },
  {
    ruleName: 'Average transaction amount exceed past period average',
    ruleAction: 'SUSPEND',
    ruleId: 'R-122',
    nature: 'FRAUD',
    ruleInstanceId: sampleGuid(0.9),
    ruleDescription:
      'The average daily amount of transactions of a user in the first period, is >= X times higher than avg. amount of transactions in the second periods',
    ruleHit: true,
  },
  {
    ruleName: 'High traffic between the same parties',
    ruleAction: 'FLAG',
    ruleId: 'R-119',
    nature: 'AML',
    ruleInstanceId: sampleGuid(1),
    ruleDescription:
      'Same receiver and destination details are used >= x times in time t',
    ruleHit: true,
  },
]

export const ruleInstances: RuleInstance[] = [
  {
    id: 'a25685ad',
    ruleId: 'R-2',
    casePriority: 'P1',
    parameters: {
      transactionAmountThreshold: {
        USD: 10000,
      },
    },
    action: 'SUSPEND',
    type: 'TRANSACTION',
    ruleNameAlias: 'Transaction amount too high',
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
          ADA: 1000,
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
    updatedAt: 1688114634781,
    runCount: 1848,
    hitCount: 1434,
  },
  {
    id: 'e8c3b853',
    ruleId: 'R-1',
    casePriority: 'P1',
    parameters: {},
    action: 'FLAG',
    type: 'TRANSACTION',
    ruleNameAlias: 'First payment of a Customers',
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
    createdAt: 1685604237253,
    updatedAt: 1688115753059,
    runCount: 1848,
    hitCount: 8,
  },
]

export function randomRules(): ExecutedRulesResult[] {
  return randomArray((i) => rules[i], 0.1, rules.length)
}
