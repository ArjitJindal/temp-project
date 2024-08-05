import { JSONSchemaType } from 'ajv'
import { compact, uniq } from 'lodash'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'

type AggregationDataValue = string[]

type TooManyCounterpartyCountryRulePartialParameters = {
  transactionsLimit: number
}
export type TooManyCounterpartyCountryRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TooManyCounterpartyCountryRulePartialParameters

@traceable
export default class TooManyCounterpartyCountryRule extends TransactionsPatternVelocityBaseRule<
  TooManyCounterpartyCountryRuleParameters,
  AggregationDataValue
> {
  public static getSchema(): JSONSchemaType<TooManyCounterpartyCountryRuleParameters> {
    const baseSchema = TransactionsPatternVelocityBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TooManyCounterpartyCountryRulePartialParameters> =
      {
        type: 'object',
        properties: {
          transactionsLimit: {
            type: 'integer',
            title: 'Unique countries limit',
          },
        },
        required: ['transactionsLimit'],
      }

    return mergeRuleSchemas<TooManyCounterpartyCountryRuleParameters>(
      baseSchema,
      partialSchema
    )
  }
  uniqueCountries: { [key: string]: Set<string> } = {
    sender: new Set<string>(),
    receiver: new Set<string>(),
  }

  override matchPattern(
    _transaction: Transaction,
    _direction: 'origin' | 'destination',
    _userType: 'sender' | 'receiver'
  ): boolean {
    return true
  }

  override async getAggregationData(
    transactions: AuxiliaryIndexTransaction[],
    direction: 'origin' | 'destination'
  ): Promise<AggregationDataValue> {
    return compact(
      uniq(
        transactions.map((transaction) => {
          return direction === 'origin'
            ? transaction.originAmountDetails?.country
            : transaction.destinationAmountDetails?.country
        })
      )
    )
  }

  protected merge(
    aggValue1: AggregationDataValue | undefined,
    aggValue2: AggregationDataValue | undefined
  ): AggregationDataValue {
    return uniq(compact([...(aggValue1 ?? []), ...(aggValue2 ?? [])]))
  }

  protected reduce(aggValue: AggregationDataValue | undefined): number {
    return uniq(aggValue ?? []).length
  }

  protected getInitialAggregationDataValue(): AggregationDataValue {
    return []
  }

  override getNeededTransactionFields(): Array<keyof Transaction> {
    return ['originAmountDetails', 'destinationAmountDetails']
  }
  override isAggregationSupported() {
    return true
  }

  override isMatchPaymentMethodDetailsEnabled() {
    return false
  }
}
