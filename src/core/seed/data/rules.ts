import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { sampleGuid } from '@/core/seed/samplers/id'
import { randomArray } from '@/utils/prng'

export const rules: ExecutedRulesResult[] = [
  {
    ruleName: 'Round payment amounts',
    ruleAction: 'ALLOW',
    ruleId: 'R-1',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'Round payment amounts',
    ruleHit: true,
  },
  {
    ruleName: 'Round payments in short time',
    ruleAction: 'FLAG',
    ruleId: 'R-2',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'Round payments in short time',
    ruleHit: true,
  },
  {
    ruleName: 'There were linked transactions that equal or are higher than 1K',
    ruleAction: 'FLAG',
    ruleId: 'R-3',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'Linked transactions that equal or are higher than 1K',
    ruleHit: true,
  },
  {
    ruleName: 'User is blocked on sanctions list',
    ruleAction: 'BLOCK',
    ruleId: 'R-4',
    nature: 'SCREENING',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'User is blocked on sanctions list',
    ruleHit: true,
  },
  {
    ruleName: 'The same IBAN was used more than 5 times',
    ruleAction: 'FLAG',
    ruleId: 'R-5',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'Same IBAN was used more than 5 times',
    ruleHit: true,
  },
  {
    ruleName: 'Unexplained large cash deposits',
    ruleAction: 'FLAG',
    ruleId: 'R-6',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: 'Unexplained large cash deposits',
    ruleHit: true,
  },
]

export function randomRules(): ExecutedRulesResult[] {
  return randomArray((i) => rules[i], 0.1, rules.length)
}
