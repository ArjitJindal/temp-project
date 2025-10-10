import { AggregationCursor } from 'mongodb'
import { FalsePositiveDetails } from '@/@types/openapi-internal/FalsePositiveDetails'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'
import { traceable } from '@/core/xray'
import { Vars } from '@/services/rules-engine/utils/format-description'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RuleExecutionSanctionsDetails } from '@/@types/openapi-internal/RuleExecutionSanctionsDetails'

export type RuleHitResultItem = {
  direction: RuleHitDirection
  vars?: Vars
  falsePositiveDetails?: FalsePositiveDetails
  sanctionsDetails?: SanctionsDetails[]
}

export type RuleExecutionResult = {
  sanctionsDetails?: RuleExecutionSanctionsDetails[]
}
export type RuleHitResult = Array<RuleHitResultItem | undefined>

export type UserOngoingHitResult = RuleHitResultItem & {
  hitUsersCursors: AggregationCursor<InternalUser>[]
}

export type RuleResult = {
  ruleHitResult: RuleHitResult
  ruleExecutionResult?: RuleExecutionResult
}

export type RuleFilter = () => Promise<boolean> | boolean

@traceable
export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public abstract computeRule(): Promise<
    RuleResult | UserOngoingHitResult | undefined
  >
}
