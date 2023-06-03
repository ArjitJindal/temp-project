import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { Attribute } from '@/services/copilot/attributes/attributes'

export class TransactionsBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
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
    let roundTransactions = 0
    let debtorSameCountryAsUser = 0
    let creditorSameCountryAsUser = 0
    let originDestinationSameIBAN = 0
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

    inputData.transactions.forEach((t) => {
      // Count transactions into incremental thresholds
      const amount = t.destinationAmountDetails?.transactionAmount
      if (amount) {
        Object.keys(thresholds).forEach((threshold) => {
          const thresholdI = parseInt(threshold)
          if (amount >= thresholdI) {
            thresholds[thresholdI]++
          }
        })

        if (amount && amount % 100 === 0) {
          roundTransactions++
        }
      }

      transactionsCount++

      // If user is origin
      if (t.originUserId === inputData.user.userId) {
        if (
          attributes.getAttribute('country') ===
          t.destinationAmountDetails?.country
        ) {
          debtorSameCountryAsUser++
        }
      }

      // If user is destination
      if (t.destinationUser?.userId === inputData.user.userId) {
        if (
          attributes.getAttribute('country') === t.originAmountDetails?.country
        ) {
          creditorSameCountryAsUser++
        }
      }

      // If the same IBAN for origin destination
      if (
        t.destinationPaymentDetails?.method === 'IBAN' &&
        t.originPaymentDetails?.method === 'IBAN'
      ) {
        if (t.destinationPaymentDetails?.IBAN === t.originPaymentDetails.IBAN) {
          originDestinationSameIBAN++
        }
      }

      // Distinct counts
      ipAddressSet.add(t.deviceData?.ipAddress)
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
    attributes.setAttribute('roundTransactionsCount', roundTransactions)
    attributes.setAttribute(
      'debtorSameCountryAsUserCount',
      debtorSameCountryAsUser
    )
    attributes.setAttribute(
      'creditorSameCountryAsUserCount',
      creditorSameCountryAsUser
    )
    attributes.setAttribute(
      'originDestinationSameIBANCount',
      originDestinationSameIBAN
    )

    attributes.setAttribute('distinctIpAddressCount', ipAddressSet.size)
    attributes.setAttribute(
      'distinctOriginPaymentMethodCount',
      originPaymentMethods.size
    )
    attributes.setAttribute(
      'distinctDestinationPaymentMethodCount',
      destinationPaymentMethods.size
    )
    attributes.setAttribute('distinctOriginUserCount', originUsers.size)
    attributes.setAttribute(
      'distinctDestinationUserCount',
      destinationUsers.size
    )
    attributes.setAttribute(
      'distinctOriginCurrencyCount',
      originCurrencies.size
    )
    attributes.setAttribute(
      'distinctDestinationCurrencyCount',
      destinationCurrencies.size
    )

    attributes.setAttribute('minOriginAmount', minOriginAmount)
    attributes.setAttribute('maxOriginAmount', maxOriginAmount)
    attributes.setAttribute('minDestinationAmount', minDestinationAmount)
    attributes.setAttribute('maxDestinationAmount', maxDestinationAmount)

    attributes.setAttribute('totalOriginAmount', totalOriginAmount)
    attributes.setAttribute('totalDestinationAmount', totalDestinationAmount)
    attributes.setAttribute(
      'averageDestinationAmount',
      Math.floor(totalDestinationAmount / transactionsCount)
    )
    attributes.setAttribute(
      'averageOriginAmount',
      Math.floor(totalOriginAmount / transactionsCount)
    )

    attributes.setAttribute(
      'transactionsPerSecond',
      Math.floor(transactionsCount / ((maxTime - minTime) / 1000))
    )
    attributes.setAttribute(
      'transactionsPerMinute',
      Math.floor(transactionsCount / ((maxTime - minTime) / (1000 * 60)))
    )
    attributes.setAttribute(
      'transactionsPerHour',
      Math.floor(transactionsCount / ((maxTime - minTime) / (1000 * 60 * 60)))
    )
    attributes.setAttribute(
      'transactionsPer24Hour',
      Math.floor(
        transactionsCount / ((maxTime - minTime) / (1000 * 60 * 60 * 24))
      )
    )
    attributes.setAttribute(
      'transactionsPer7Day',
      Math.floor(
        transactionsCount / ((maxTime - minTime) / (1000 * 60 * 60 * 24 * 7))
      )
    )
    attributes.setAttribute(
      'transactionsPer30Day',
      Math.floor(
        transactionsCount / ((maxTime - minTime) / (1000 * 60 * 60 * 24 * 30))
      )
    )

    Object.keys(thresholds).forEach((key) =>
      attributes.setAttribute(
        `transactionAmountOver${key}Count` as Attribute,
        thresholds[parseInt(key)]
      )
    )
  }
}
