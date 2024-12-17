import { Document } from 'mongodb'
import { RuleHitResult, UserOngoingHitResult } from '../rule'
import UserInactivity from '../user-ongoing-rules/user-inactivity'
import { UserOngoingRule, UserRule } from './rule'
import SanctionsBankUserRule from './sanctions-bank-name'
import SanctionsBusinessUserRule from './sanctions-business-user'
import SanctionsConsumerUserRule from './sanctions-consumer-user'
import TestAlwaysHitRule from './tests/test-always-hit-rule'
import UserAddressChange from './user-address-change'
import UserOnboardedFromHighRiskCountry from './user-onboarded-from-high-risk-country'
import { traceable } from '@/core/xray'
import DowJonesConsumerUserRule from '@/services/rules-engine/user-rules/dowjones-consumer-user'
import ListScreeningConsumerUser from '@/services/rules-engine/user-rules/list-screening-consumer-user'
import OpenSanctionsConsumerUserRule from '@/services/rules-engine/user-rules/open-sanctions-consumer-user'

@traceable
export class UserRuleBase extends UserRule<unknown> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
    return
  }
}

export class UserOngoingRuleBase extends UserOngoingRule<unknown> {
  public async computeRule(): Promise<UserOngoingHitResult | undefined> {
    // skip
    return
  }

  public getHitRulePipline(_params: unknown): Document[] {
    // skip
    return []
  }
}

export const _USER_RULES = {
  'sanctions-business-user': SanctionsBusinessUserRule,
  'sanctions-bank-name': SanctionsBankUserRule,
  'sanctions-consumer-user': SanctionsConsumerUserRule,
  'user-address-change': UserAddressChange,
  'user-onboarded-from-high-risk-country': UserOnboardedFromHighRiskCountry,
  'dowjones-consumer-user': DowJonesConsumerUserRule,
  'list-screening-consumer-user': ListScreeningConsumerUser,
  'open-sanctions-consumer-user': OpenSanctionsConsumerUserRule,
  // TESTING-ONLY RULES
  'tests/test-always-hit-rule': TestAlwaysHitRule,
} as const

export type UserRuleImplementationName = keyof typeof _USER_RULES

export const USER_RULES = _USER_RULES as unknown as {
  [key: string]: typeof UserRuleBase
}

export const _USER_ONGOING_SCREENING_RULES = {
  'user-inactivity': UserInactivity,
}

export type UserOngoingScreeningRuleImplementationName =
  keyof typeof _USER_ONGOING_SCREENING_RULES

export const USER_ONGOING_SCREENING_RULES =
  _USER_ONGOING_SCREENING_RULES as unknown as {
    [key: string]: typeof UserOngoingRuleBase
  }
