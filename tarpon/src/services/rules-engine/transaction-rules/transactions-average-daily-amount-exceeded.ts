import { JSONSchemaType } from 'ajv'
import TransactionAverageAmountExceededRule from './transactions-average-amount-exceeded'
import TransactionsDeviationBaseRule, {
  TransactionsExceededParameters,
} from './transactions-exceeded-base'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { traceable } from '@/core/xray'

type TransactionsAverageAmountExceededPartialParameters = {
  multiplierThreshold: {
    currency: string
    value: number
  }
  valueThresholdPeriod1?: {
    min?: number
    max?: number
  }
}

export type TransactionsAverageAmountExceededParameters =
  TransactionsExceededParameters &
    TransactionsAverageAmountExceededPartialParameters

@traceable
export default class TransactionAverageDailyAmountExceededRule extends TransactionsDeviationBaseRule<TransactionsAverageAmountExceededParameters> {
  public static getSchema(): JSONSchemaType<TransactionsAverageAmountExceededParameters> {
    return TransactionAverageAmountExceededRule.getSchema()
  }

  protected getAggregationType(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT' {
    return 'DAILY_AMOUNT'
  }

  protected getAggregatorMethod(): 'SUM' | 'AVG' {
    return 'AVG'
  }

  protected getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  } {
    return {
      currency: this.parameters.multiplierThreshold.currency as CurrencyCode,
      value: this.parameters.multiplierThreshold.value,
    }
  }
}
