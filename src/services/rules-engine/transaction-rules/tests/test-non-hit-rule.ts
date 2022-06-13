import { TransactionRule } from '../rule'

export default class TestNonHitRule extends TransactionRule<unknown> {
  public async computeRule() {
    return undefined
  }
}
