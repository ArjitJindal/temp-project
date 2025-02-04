import getSymbolFromCurrency from 'currency-symbol-map'
import { round as lodashRound } from 'lodash'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { traceable } from '@/core/xray'
import { CurrencyService } from '@/services/currency'

@traceable
export class TransactionsBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    if (inputData.transactions.length === 0) {
      return
    }
    let minOriginAmountInUSD: number | null = null
    let maxOriginAmountInUSD: number | null = null
    let minDestinationAmountInUSD: number | null = null
    let maxDestinationAmountInUSD: number | null = null
    let totalDestinationAmountInUSD = 0
    let totalOriginAmountInUSD = 0

    const transactions = inputData.transactions.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return a.createdAt < b.createdAt ? 1 : -1
      }
      return 0
    })

    const mainCurrency =
      transactions.at(0)?.originAmountDetails?.transactionCurrency

    const currencySymbol = getSymbolFromCurrency(mainCurrency || '')

    const firstPaymentAmountInUsd = mainCurrency
      ? CurrencyService.getExchangeRate(
          mainCurrency,
          'USD',
          inputData.exchangeRates
        )
      : undefined

    transactions.forEach((t) => {
      const originAmountInUSD = t.originAmountDetails
        ? CurrencyService.getTargetCurrencyAmount(
            t.originAmountDetails,
            'USD',
            inputData.exchangeRates
          ).transactionAmount
        : undefined

      const destinationAmountInUSD = t.destinationAmountDetails
        ? CurrencyService.getTargetCurrencyAmount(
            t.destinationAmountDetails,
            'USD',
            inputData.exchangeRates
          ).transactionAmount
        : undefined

      if (originAmountInUSD) {
        minOriginAmountInUSD = minOriginAmountInUSD
          ? Math.min(minOriginAmountInUSD, originAmountInUSD)
          : originAmountInUSD
        maxOriginAmountInUSD = maxOriginAmountInUSD
          ? Math.max(maxOriginAmountInUSD, originAmountInUSD)
          : originAmountInUSD
        totalOriginAmountInUSD += originAmountInUSD
      }

      if (destinationAmountInUSD) {
        minDestinationAmountInUSD = minDestinationAmountInUSD
          ? Math.min(minDestinationAmountInUSD, destinationAmountInUSD)
          : destinationAmountInUSD
        maxDestinationAmountInUSD = maxDestinationAmountInUSD
          ? Math.max(maxDestinationAmountInUSD, destinationAmountInUSD)
          : destinationAmountInUSD
        totalDestinationAmountInUSD += destinationAmountInUSD
      }
    })

    const convertToMainCurrency = (amountInUSD: number | null) => {
      return amountInUSD
        ? CurrencyService.getTargetCurrencyAmount(
            {
              transactionAmount: amountInUSD,
              transactionCurrency: 'USD',
            },
            mainCurrency || 'USD',
            inputData.exchangeRates
          ).transactionAmount
        : undefined
    }

    const minOriginAmount = convertToMainCurrency(minOriginAmountInUSD)
    const minDestinationAmount = convertToMainCurrency(
      minDestinationAmountInUSD
    )
    const firstPaymentAmount = convertToMainCurrency(
      firstPaymentAmountInUsd ?? 0
    )
    const maxOriginAmount = convertToMainCurrency(maxOriginAmountInUSD)
    const maxDestinationAmount = convertToMainCurrency(
      maxDestinationAmountInUSD
    )
    const totalOriginAmount = convertToMainCurrency(totalOriginAmountInUSD) ?? 0
    const totalDestinationAmount =
      convertToMainCurrency(totalDestinationAmountInUSD) ?? 0

    const averageOriginAmount = totalOriginAmount / transactions.length
    const averageDestinationAmount =
      totalDestinationAmount / transactions.length

    const round = (amount: number | undefined) => {
      return lodashRound(amount ?? 0, 2)
    }

    attributes.setAttribute('transactionsCount', transactions.length)
    attributes.setAttribute(
      'minOriginAmount',
      `${currencySymbol}${round(minOriginAmount)}`
    )
    attributes.setAttribute(
      'maxOriginAmount',
      `${currencySymbol}${round(maxOriginAmount)}`
    )
    attributes.setAttribute(
      'totalOriginAmount',
      `${currencySymbol}${round(totalOriginAmount)}`
    )
    attributes.setAttribute(
      'averageOriginAmount',
      `${currencySymbol}${round(averageOriginAmount)}`
    )
    attributes.setAttribute(
      'minDestinationAmount',
      `${currencySymbol}${round(minDestinationAmount)}`
    )
    attributes.setAttribute(
      'maxDestinationAmount',
      `${currencySymbol}${round(maxDestinationAmount)}`
    )
    attributes.setAttribute(
      'totalDestinationAmount',
      `${currencySymbol}${round(totalDestinationAmount)}`
    )
    attributes.setAttribute(
      'averageDestinationAmount',
      `${currencySymbol}${round(averageDestinationAmount)}`
    )
    attributes.setAttribute(
      'firstPaymentAmount',
      `${currencySymbol}${round(firstPaymentAmount)}`
    )

    if (transactions.length < 20) {
      attributes.setAttribute(
        'transactionIds',
        transactions.map((t) => t.transactionId)
      )
    }
  }
}
