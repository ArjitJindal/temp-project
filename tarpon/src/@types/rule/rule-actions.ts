import { RuleAction } from '../openapi-public/RuleAction'

// NOTE: The order matters here. Lower index, higher precedence.
export const RULE_ACTIONS: RuleAction[] = ['BLOCK', 'SUSPEND', 'FLAG', 'ALLOW']
