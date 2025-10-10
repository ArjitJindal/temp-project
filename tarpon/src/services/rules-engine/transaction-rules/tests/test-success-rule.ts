import { RuleHitResult } from '../../rule'
import { TransactionRule } from '../rule'

export default class TestSuccessRule extends TransactionRule<unknown> {
  public async computeRule() {
    return {
      ruleHitResult: [
        {
          direction: 'ORIGIN',
          vars: {},
        },
        {
          direction: 'DESTINATION',
          vars: {},
        },
      ] as RuleHitResult,
    }
  }
}
