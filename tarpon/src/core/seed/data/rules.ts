import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { sampleGuid } from '@/core/seed/samplers/id'
import { randomArray } from '@/utils/prng'

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

export function randomRules(): ExecutedRulesResult[] {
  return randomArray((i) => rules[i], 0.1, rules.length)
}
