import { JSONSchemaType } from 'ajv'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type TransactionsRoundValueVelocityRuleParameters =
  TransactionsPatternVelocityRuleParameters

export default class TransactionsRoundValueVelocityRule extends TransactionsPatternVelocityBaseRule<TransactionsRoundValueVelocityRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionsRoundValueVelocityRuleParameters> {
    return TransactionsPatternVelocityBaseRule.getBaseSchema()
  }

  protected matchPattern(
    transaction: Transaction,
    direction?: 'origin' | 'destination'
  ): boolean {
    const amount =
      direction === 'origin'
        ? transaction.originAmountDetails?.transactionAmount
        : transaction.destinationAmountDetails?.transactionAmount
    return amount ? this.isRoundValue(amount) : false
  }

  private isRoundValue(value: number) {
    return value % 100 === 0
  }
}
