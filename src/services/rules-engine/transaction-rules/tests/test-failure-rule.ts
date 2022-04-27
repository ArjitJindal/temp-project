import { TransactionRule } from '../rule'
import { NoData } from '../errors'

export default class TestFailureRule extends TransactionRule<unknown> {
  public async computeRule(): Promise<any> {
    throw new NoData('Failed when executing the rule')
  }
}
