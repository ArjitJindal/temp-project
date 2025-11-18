import getSymbolFromCurrency from 'currency-symbol-map'
import round from 'lodash/round'
import { AttributeSet } from './attribute-set'
import {
  AttributeBuilder,
  BuilderKey,
  InputData,
} from '@/@types/copilot/attributeBuilder'
import { traceable } from '@/core/xray'
import { CurrencyService } from '@/services/currency'
@traceable
export class TransactionsBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return []
  }

  build(attributes: AttributeSet, inputData: InputData) {
    // Use aggregates if available (from ClickHouse or MongoDB), otherwise fall back to transactions
    if (inputData.transactionAggregates) {
      const aggregates = inputData.transactionAggregates

      if (aggregates.count === 0) {
        return
      }

      const mainCurrency = aggregates.firstTransactionCurrency

      const convertToMainCurrency = (amountInUSD: number | null) => {
        return amountInUSD
          ? CurrencyService.getTargetCurrencyAmount(
              {
                transactionAmount: amountInUSD,
                transactionCurrency: 'USD',
              },
              (mainCurrency || 'USD') as any,
              inputData.exchangeRates
            ).transactionAmount
          : undefined
      }

      const minOriginAmount = convertToMainCurrency(
        aggregates.minOriginAmountInUSD
      )
      const minDestinationAmount = convertToMainCurrency(
        aggregates.minDestinationAmountInUSD
      )
      const firstPaymentAmount = convertToMainCurrency(
        aggregates.firstPaymentAmountInUSD ?? 0
      )
      const maxOriginAmount = convertToMainCurrency(
        aggregates.maxOriginAmountInUSD
      )
      const maxDestinationAmount = convertToMainCurrency(
        aggregates.maxDestinationAmountInUSD
      )
      const totalOriginAmount =
        convertToMainCurrency(aggregates.totalOriginAmountInUSD) ?? 0
      const totalDestinationAmount =
        convertToMainCurrency(aggregates.totalDestinationAmountInUSD) ?? 0

      const averageOriginAmount = totalOriginAmount / aggregates.count
      const averageDestinationAmount = totalDestinationAmount / aggregates.count

      const roundFn = (amount: number | undefined) => {
        return round(amount ?? 0, 2)
      }

      const currencySymbol = getSymbolFromCurrency(mainCurrency || '')

      attributes.setAttribute('transactionsCount', aggregates.count)
      attributes.setAttribute(
        'minOriginAmount',
        `${currencySymbol}${roundFn(minOriginAmount)}`
      )
      attributes.setAttribute(
        'maxOriginAmount',
        `${currencySymbol}${roundFn(maxOriginAmount)}`
      )
      attributes.setAttribute(
        'totalOriginAmount',
        `${currencySymbol}${roundFn(totalOriginAmount)}`
      )
      attributes.setAttribute(
        'averageOriginAmount',
        `${currencySymbol}${roundFn(averageOriginAmount)}`
      )
      attributes.setAttribute(
        'minDestinationAmount',
        `${currencySymbol}${roundFn(minDestinationAmount)}`
      )
      attributes.setAttribute(
        'maxDestinationAmount',
        `${currencySymbol}${roundFn(maxDestinationAmount)}`
      )
      attributes.setAttribute(
        'totalDestinationAmount',
        `${currencySymbol}${roundFn(totalDestinationAmount)}`
      )
      attributes.setAttribute(
        'averageDestinationAmount',
        `${currencySymbol}${roundFn(averageDestinationAmount)}`
      )
      attributes.setAttribute(
        'firstPaymentAmount',
        `${currencySymbol}${roundFn(firstPaymentAmount)}`
      )

      if (aggregates.transactionIds.length > 0) {
        attributes.setAttribute('transactionIds', aggregates.transactionIds)
      }

      return
    }

    // Fallback to transactions array when aggregates are not available
    if (inputData.transactions) {
      attributes.setAttribute(
        'transactionsCount',
        inputData.transactions.length
      )
    }
  }
}
