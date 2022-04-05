import { Rule } from '../rule'
import { NoData } from '../errors'

export default class TestFailureRule extends Rule<unknown> {
  public async computeRule(): Promise<any> {
    throw new NoData('Failed when executing the rule')
  }
}
