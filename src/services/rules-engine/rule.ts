import { FalsePositiveDetails } from '@/@types/openapi-internal/FalsePositiveDetails'
import { Vars } from '@/services/rules-engine/utils/format-description'

export type RuleHitResult = Array<{
  direction: 'ORIGIN' | 'DESTINATION'
  vars: Vars
  falsePositiveDetails?: FalsePositiveDetails
}>

export type RuleFilter = () => Promise<boolean> | boolean

export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public async computeRule(): Promise<RuleHitResult | undefined> {
    throw new Error('Not implemented')
  }
}
