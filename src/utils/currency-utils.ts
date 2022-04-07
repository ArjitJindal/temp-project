import fetch from 'node-fetch'
import _ from 'lodash'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const cachedData: {
  [sourceCurrency: string]: { [targetCurrency: string]: number }
} = {}

/**
 * We use the open source project https://github.com/fawazahmed0/currency-api to get
 * the exchange rate between currencies. It'll be updated daily and it seemed to work
 * stabily since 2020-11-22.
 * TODO: We could fork and pull the repo daily and upload to our S3 or DynamoDB for
 * performance improvement (it currently takes a network call to jsdelivr CDN)
 */
export async function getCurrencyExchangeRate(
  sourceCurrency: string,
  targetCurrency: string
) {
  const sourceCurr = sourceCurrency.toLowerCase()
  const targetCurr = targetCurrency.toLowerCase()
  if (cachedData?.[sourceCurr]?.[targetCurr]) {
    return cachedData[sourceCurr][targetCurr]
  }
  const apiUri = `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${sourceCurr}/${targetCurr}.min.json`
  try {
    const rate = (await (await fetch(apiUri)).json())[targetCurr]
    _.set(cachedData, `${sourceCurr}.${targetCurr}`, rate)
    return rate
  } catch (e) {
    console.error('Failed to fetch the exchange rate!')
    throw e
  }
}

export async function getTargetCurrencyAmount(
  transactionAmountDefails: TransactionAmountDetails,
  targetCurrency: string
): Promise<TransactionAmountDetails> {
  const sourceCurrency = transactionAmountDefails.transactionCurrency
  if (sourceCurrency === targetCurrency) {
    return transactionAmountDefails
  }
  const rate = await getCurrencyExchangeRate(sourceCurrency, targetCurrency)
  return {
    transactionAmount: transactionAmountDefails.transactionAmount * rate,
    transactionCurrency: targetCurrency,
  }
}
