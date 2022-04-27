import { TransactionRule } from '../rule'

export default class TestSuccessRule extends TransactionRule<unknown> {
  public async computeRule() {
    return {
      action: this.action,
    }
  }
}
