import { FalsePositiveDetails } from '@/@types/openapi-internal/FalsePositiveDetails'
import { Vars } from '@/services/rules-engine/utils/format-description'

export type RuleHitResultItem = {
  direction: 'ORIGIN' | 'DESTINATION'
  vars: Vars
  falsePositiveDetails?: FalsePositiveDetails
}
export type RuleHitResult = Array<RuleHitResultItem | undefined>

export type RuleFilter = () => Promise<boolean> | boolean

export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public abstract computeRule(): Promise<RuleHitResult | undefined>
}
