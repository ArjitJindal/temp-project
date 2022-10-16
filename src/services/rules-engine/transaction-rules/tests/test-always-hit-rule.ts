import { TransactionRule } from '../rule'

export default class TestAlwaysHitRule extends TransactionRule<unknown> {
  public async computeRule() {
    return {
      action: 'BLOCK' as const,
      vars: {},
      hitDirections: ['ORIGIN' as const, 'DESTINATION' as const],
    }
  }
}
