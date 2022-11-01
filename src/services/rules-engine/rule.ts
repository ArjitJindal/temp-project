import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Vars } from '@/services/rules-engine/utils/format-description'

export type RuleResult = {
  action: RuleAction
  vars?: Vars
  hitDirections?: RuleHitDirection[]
}

export type RuleFilter = () => Promise<boolean> | boolean

export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error('Not implemented')
  }
}
