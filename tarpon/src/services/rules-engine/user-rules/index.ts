import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import SanctionsBankUserRule from './sanctions-bank-name'
import SanctionsBusinessUserRule from './sanctions-business-user'
import SanctionsConsumerUserRule from './sanctions-consumer-user'
import TestAlwaysHitRule from './tests/test-always-hit-rule'
import UserAddressChange from './user-address-change'
import UserInactivity from './user-inactivity'
import UserOnboardedFromHighRiskCountry from './user-onboarded-from-high-risk-country'
import { traceable } from '@/core/xray'
import MerchantMonitoringIndustryUserRule from '@/services/rules-engine/user-rules/merchant-monitoring-industry'

@traceable
export class UserRuleBase extends UserRule<unknown> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
    return
  }
}

export const _USER_RULES = {
  'merchant-monitoring-industry': MerchantMonitoringIndustryUserRule,
  'sanctions-business-user': SanctionsBusinessUserRule,
  'sanctions-bank-name': SanctionsBankUserRule,
  'sanctions-consumer-user': SanctionsConsumerUserRule,
  'user-address-change': UserAddressChange,
  'user-inactivity': UserInactivity,
  'user-onboarded-from-high-risk-country': UserOnboardedFromHighRiskCountry,
  // TESTING-ONLY RULES
  'tests/test-always-hit-rule': TestAlwaysHitRule,
} as const

export type UserRuleImplementationName = keyof typeof _USER_RULES

export const USER_RULES = _USER_RULES as unknown as {
  [key: string]: typeof UserRuleBase
}
