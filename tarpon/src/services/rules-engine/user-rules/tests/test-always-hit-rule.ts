import { UserRule } from '../rule'
import { RuleHitResult } from '../../rule'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'

export default class TestAlwaysHitRule extends UserRule<{
  hitDirections?: RuleHitDirection[]
}> {
  public async computeRule() {
    return {
      ruleHitResult: (
        this.parameters.hitDirections || ['ORIGIN', 'DESTINATION']
      ).map((direction) => ({
        direction,
        vars: {},
      })) as RuleHitResult,
    }
  }
}
