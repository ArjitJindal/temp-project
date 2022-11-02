import { TransactionRule } from '../rule'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'

export default class TestAlwaysHitRule extends TransactionRule<{
  hitDirections?: RuleHitDirection[]
}> {
  public async computeRule() {
    return {
      action: 'BLOCK' as const,
      vars: {},
      hitDirections: this.parameters.hitDirections ?? [
        'ORIGIN' as const,
        'DESTINATION' as const,
      ],
    }
  }
}
