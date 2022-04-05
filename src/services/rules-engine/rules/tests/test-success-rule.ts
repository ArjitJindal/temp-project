import { Rule } from '../rule'
import { RuleParameters } from '@/@types/rule/rule-instance'

export default class TestSuccessRule extends Rule<RuleParameters> {
  public async computeRule() {
    return {
      action: this.action,
    }
  }
}
