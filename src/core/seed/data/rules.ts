import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { sampleGuid } from '@/core/seed/samplers/id'
import { sampleDescription } from '@/core/seed/samplers/rule_result'
import { randomArray } from '@/utils/prng'

export const rules: ExecutedRulesResult[] = [
  {
    ruleName: 'Sample rule',
    ruleAction: 'ALLOW',
    ruleId: 'R-1',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: sampleDescription(0.1),
    ruleHit: true,
  },
  {
    ruleName: 'Sample flag rule',
    ruleAction: 'FLAG',
    ruleId: 'R-2',
    nature: 'FRAUD',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: sampleDescription(0.1),
    ruleHit: true,
  },
  {
    ruleName: 'Sample block rule',
    ruleAction: 'BLOCK',
    ruleId: 'R-3',
    nature: 'SCREENING',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: sampleDescription(0.1),
    ruleHit: true,
  },
  {
    ruleName: 'Sample hit rule',
    ruleAction: 'FLAG',
    ruleId: 'R-4',
    nature: 'AML',
    ruleInstanceId: sampleGuid(0.1),
    ruleDescription: sampleDescription(0.1),
    ruleHit: true,
  },
]

export function randomRules(): ExecutedRulesResult[] {
  return randomArray((i) => rules[i], 0.1, rules.length)
}
