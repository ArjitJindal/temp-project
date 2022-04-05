import { Rule } from '../rule'
import { NoData } from '../errors'
import { RuleParameters } from '@/@types/rule/rule-instance'

export default class TestFailureRule extends Rule<RuleParameters> {
  public async computeRule(): Promise<any> {
    throw new NoData('Failed when executing the rule')
  }
}
