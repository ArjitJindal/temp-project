import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

type TransactionsRoundValueVelocityRulePartialParameters = {
  sameAmount?: boolean
}

export type TransactionsRoundValueVelocityRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TransactionsRoundValueVelocityRulePartialParameters

export default class TransactionsRoundValueVelocityRule extends TransactionsPatternVelocityBaseRule<TransactionsRoundValueVelocityRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionsRoundValueVelocityRuleParameters> {
    const baseSchema = TransactionsPatternVelocityBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TransactionsRoundValueVelocityRulePartialParameters> =
      {
        type: 'object',
        properties: {
          sameAmount: {
            type: 'boolean',
            title: 'Check for same amount of round transactions only',
            description:
              'When same amount is enabled, system check for same amount of round transactions only',
            nullable: true,
          },
        },
        required: [],
      }

    return mergeRuleSchemas<TransactionsRoundValueVelocityRuleParameters>(
      baseSchema,
      partialSchema
    )
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

  protected groupTransactions(transactions: Transaction[]): Transaction[][] {
    const obj = _.groupBy(
      transactions,
      (t) =>
        `${t.originAmountDetails?.transactionAmount}${t.originAmountDetails?.transactionCurrency}`
    )
    return Object.values(obj)
  }

  private isRoundValue(value: number) {
    return value % 100 === 0
  }
}
