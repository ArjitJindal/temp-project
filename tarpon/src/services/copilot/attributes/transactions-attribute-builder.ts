import getSymbolFromCurrency from 'currency-symbol-map'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'

export class TransactionsBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    if (inputData.transactions.length === 0) {
      return
    }
    const thresholds: { [key: number]: number } = {
      1: 0,
      10: 0,
      100: 0,
      1_000: 0,
      10_000: 0,
      100_000: 0,
      1_000_000: 0,
    }
    let transactionsCount = 0
    const ipAddressSet = new Set()
    const originPaymentMethods = new Set()
    const destinationPaymentMethods = new Set()
    const originUsers = new Set()
    const destinationUsers = new Set()
    const originCurrencies = new Set()
    const destinationCurrencies = new Set()

    let minTime = 0
    let maxTime = 0

    let minOriginAmount = 0
    let maxOriginAmount = 0
    let minDestinationAmount = 0
    let maxDestinationAmount = 0

    let totalDestinationAmount = 0
    let totalOriginAmount = 0

    const transactions = inputData.transactions.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return a.createdAt < b.createdAt ? 1 : -1
      }
      return 0
    })

    const mainCurrency =
      transactions.at(0)?.originAmountDetails?.transactionCurrency
    const currencySymbol = getSymbolFromCurrency(mainCurrency || '')

    const firstPaymentAmount =
      transactions.at(0)?.originAmountDetails?.transactionAmount
    transactions.forEach((t) => {
      // Count transactions into incremental thresholds
      const amount = t.destinationAmountDetails?.transactionAmount
      if (amount) {
        Object.keys(thresholds).forEach((threshold) => {
          const thresholdI = parseInt(threshold)
          if (amount >= thresholdI) {
            thresholds[thresholdI]++
          }
        })
      }

      transactionsCount++

      // Distinct counts
      ipAddressSet.add(t.originDeviceData?.ipAddress)
      ipAddressSet.add(t.destinationDeviceData?.ipAddress)
      originPaymentMethods.add(JSON.stringify(t.originPaymentDetails?.method))
      destinationPaymentMethods.add(
        JSON.stringify(t.destinationPaymentDetails?.method)
      )
      originUsers.add(t.originUserId)
      destinationUsers.add(t.destinationUserId)
      originCurrencies.add(t.originAmountDetails?.transactionCurrency)
      destinationCurrencies.add(t.destinationAmountDetails?.transactionCurrency)

      // For basic velocity
      if (!minTime) {
        minTime = t.timestamp
      }
      if (!maxTime) {
        maxTime = t.timestamp
      }
      if (t.timestamp < minTime) {
        minTime = t.timestamp
      }
      if (t.timestamp > maxTime) {
        maxTime = t.timestamp
      }

      // Min/Max Payment amounts
      if (!minDestinationAmount) {
        minDestinationAmount =
          t.destinationAmountDetails?.transactionAmount || 0
      }
      if (!minOriginAmount) {
        minOriginAmount = t.originAmountDetails?.transactionAmount || 0
      }
      if (!maxDestinationAmount) {
        maxDestinationAmount =
          t.destinationAmountDetails?.transactionAmount || 0
      }
      if (!maxOriginAmount) {
        maxOriginAmount = t.originAmountDetails?.transactionAmount || 0
      }

      if (
        t.destinationAmountDetails?.transactionAmount &&
        t.destinationAmountDetails?.transactionAmount < minDestinationAmount
      ) {
        minDestinationAmount = t.destinationAmountDetails?.transactionAmount
      }
      if (
        t.destinationAmountDetails?.transactionAmount &&
        t.destinationAmountDetails?.transactionAmount > maxDestinationAmount
      ) {
        maxDestinationAmount = t.destinationAmountDetails?.transactionAmount
      }
      if (
        t.originAmountDetails?.transactionAmount &&
        t.originAmountDetails?.transactionAmount < minOriginAmount
      ) {
        minOriginAmount = t.originAmountDetails?.transactionAmount
      }
      if (
        t.originAmountDetails?.transactionAmount &&
        t.originAmountDetails?.transactionAmount > maxOriginAmount
      ) {
        maxOriginAmount = t.originAmountDetails?.transactionAmount
      }
      if (t.timestamp > maxTime) {
        maxTime = t.timestamp
      }

      // Totals
      totalDestinationAmount +=
        t.destinationAmountDetails?.transactionAmount || 0
      totalOriginAmount += t.originAmountDetails?.transactionAmount || 0
    })

    attributes.setAttribute('transactionsCount', transactionsCount)
    attributes.setAttribute('minAmount', `${currencySymbol}${minOriginAmount}`)
    attributes.setAttribute('maxAmount', `${currencySymbol}${maxOriginAmount}`)
    attributes.setAttribute(
      'totalTransactionAmount',
      `${currencySymbol}${totalOriginAmount}`
    )
    attributes.setAttribute(
      'averageTransactionAmount',
      `${currencySymbol}${Math.floor(
        totalDestinationAmount / transactionsCount
      )}`
    )
    attributes.setAttribute(
      'firstPaymentAmount',
      `${currencySymbol}${firstPaymentAmount}`
    )

    // If too many transactions, then we will hit token limit for GPT
    if (transactions.length < 20) {
      attributes.setAttribute(
        'transactionIds',
        transactions.map((t) => t.transactionId)
      )
    }
  }
}
