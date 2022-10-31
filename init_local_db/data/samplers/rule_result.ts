import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'

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
    ruleName: 'Unknown rule',
    ruleAction: 'FLAG',
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleDescription: 'No description',
    ruleHit: true,
  }
}

export function sampleBlockRuleResult(): ExecutedRulesResult {
  return {
    ruleName: 'Unknown rule',
    ruleAction: 'BLOCK',
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleDescription: 'No description',
    ruleHit: true,
  }
}

export function sampleNonHitRuleResult(): ExecutedRulesResult {
  return {
    ruleName: 'Unknown rule',
    ruleAction: 'BLOCK',
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleDescription: 'No description',
    ruleHit: false,
  }
}
