import { sampleGuid } from './id'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { prng } from '@/core/seed/samplers/prng'

export function sampleAllowRuleResult(): ExecutedRulesResult {
  return {
    ruleName: 'Unknown rule',
    ruleAction: 'ALLOW',
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleDescription: 'No description',
    ruleHit: true,
  }
}

export function sampleFlagRuleResult(): ExecutedRulesResult {
  return {
    ruleName: 'Sample flag rule',
    ruleAction: 'FLAG',
    ruleId: 'R-2',
    ruleInstanceId: '2',
    ruleDescription: 'No description',
    ruleHit: true,
  }
}

export function sampleBlockRuleResult(): ExecutedRulesResult {
  return {
    ruleName: 'Sample block rule',
    ruleAction: 'BLOCK',
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleDescription: 'No description',
    ruleHit: true,
  }
}

export function sampleHitRuleResult(seed?: number): ExecutedRulesResult {
  return {
    ruleName: 'Sample hit rule',
    ruleAction: 'FLAG',
    ruleId: 'R-2',
    ruleInstanceId: sampleGuid(seed),
    ruleDescription: sampleDescription(seed),
    ruleHit: true,
  }
}

export function sampleDescription(seed?: number): string {
  if (seed == null || seed == 0) {
    return 'Awesome rule description without substitions'
  }
  return `Transactions amount is over ${prng(seed)() * 1000000}`
}

export function sampleNonHitRuleResult(seed?: number): ExecutedRulesResult {
  return {
    ruleName: 'Unknown rule',
    ruleAction: 'BLOCK',
    ruleId: 'R-1',
    ruleInstanceId: sampleGuid(seed),
    ruleDescription: 'No description',
    ruleHit: false,
  }
}
