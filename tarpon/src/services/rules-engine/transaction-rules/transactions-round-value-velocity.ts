import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import { MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'

type TransactionsRoundValueVelocityRulePartialParameters = {
  sameAmount?: boolean
  originMatchPaymentMethodDetails?: boolean
  destinationMatchPaymentMethodDetails?: boolean
}

export type TransactionsRoundValueVelocityRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TransactionsRoundValueVelocityRulePartialParameters

@traceable
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
          originMatchPaymentMethodDetails:
            MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
              title: 'Match origin payment method details',
              description:
                'When enabled, system will match origin payment method details',
            }),
          destinationMatchPaymentMethodDetails:
            MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
              title: 'Match destination payment method details',
              description:
                'When enabled, system will match destination payment method details',
            }),
        },
        required: [],
      }

    return mergeRuleSchemas<TransactionsRoundValueVelocityRuleParameters>(
      baseSchema,
      partialSchema
    )
  }

  override matchPattern(
    transaction: Transaction,
    direction?: 'origin' | 'destination'
  ): boolean {
    const amount =
      direction === 'origin'
        ? transaction.originAmountDetails?.transactionAmount
        : transaction.destinationAmountDetails?.transactionAmount
    return amount ? this.isRoundValue(amount) : false
  }

  override getNeededTransactionFields(): Array<keyof Transaction> {
    return ['originAmountDetails', 'destinationAmountDetails']
  }

  override getTransactionGroupKey(
    transaction: Transaction
  ): string | undefined {
    if (this.parameters.sameAmount) {
      return `${transaction.originAmountDetails?.transactionAmount}${transaction.originAmountDetails?.transactionCurrency}`
    }
  }

  override isAggregationSupported() {
    return false
  }

  private isRoundValue(value: number) {
    return value % 100 === 0
  }

  override isMatchPaymentMethodDetailsEnabled(
    direction: 'origin' | 'destination'
  ) {
    return direction === 'origin'
      ? this.parameters.originMatchPaymentMethodDetails
      : this.parameters.destinationMatchPaymentMethodDetails
  }
}
