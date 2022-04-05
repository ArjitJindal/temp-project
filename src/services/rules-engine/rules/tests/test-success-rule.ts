import { Rule } from '../rule'

export default class TestSuccessRule extends Rule<unknown> {
  public async computeRule() {
    return {
      action: this.action,
    }
  }
}
