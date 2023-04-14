import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import SanctionsBusinessUserRule from './sanctions-business-user'

export class UserRuleBase extends UserRule<unknown> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
    return
  }
}

export const _USER_RULES = {
  'sanctions-business-user': SanctionsBusinessUserRule,
} as const

export type UserRuleImplementationName = keyof typeof _USER_RULES

export const USER_RULES = _USER_RULES as unknown as {
  [key: string]: typeof UserRuleBase
}
