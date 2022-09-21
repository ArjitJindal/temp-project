import { JSONSchemaType } from 'ajv'
import TransactionsPatternPercentageBaseRule, {
  TransactionsPatternPercentageRuleParameters,
} from './transactions-pattern-percentage-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type TransactionsRoundValuePercentageRuleParameters =
  TransactionsPatternPercentageRuleParameters

export default class TransactionsRoundValuePercentageRule extends TransactionsPatternPercentageBaseRule<TransactionsRoundValuePercentageRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionsRoundValuePercentageRuleParameters> {
    return TransactionsPatternPercentageBaseRule.getBaseSchema()
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
