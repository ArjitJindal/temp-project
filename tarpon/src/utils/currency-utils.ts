import fetch from 'node-fetch'

import { set } from 'lodash'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { logger } from '@/core/logger'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { addNewSubsegment } from '@/core/xray'
import dayjs from '@/utils/dayjs'

const MAX_CURRENCY_API_RETRY = 3

// todo: make a proper enum type
export type Currency = string

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
  sourceCurrency: Currency,
  targetCurrency: Currency,
  date?: Date
): Promise<number> {
  // TODO: Proper retry - FR-2724
  for (let i = 1; i <= MAX_CURRENCY_API_RETRY; i++) {
    const sourceCurr = sourceCurrency.toLowerCase()
    const targetCurr = targetCurrency.toLowerCase()
    if (cachedData?.[sourceCurr]?.[targetCurr]) {
      return cachedData[sourceCurr][targetCurr]
    }
    let dateString = date ? dayjs(date).format('YYYY-MM-DD') : '2023-08-20' // Fallback as latest is not working
    if (dayjs(dateString).isAfter(dayjs('2023-08-20'))) {
      dateString = '2023-08-20'
    }
    const apiUri = `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/${dateString}/currencies/${sourceCurr}/${targetCurr}.min.json`
    const segment = await addNewSubsegment('Currency API', 'Fetch')
    try {
      const rate = (
        (await (await fetch(apiUri)).json()) as { [key: string]: number }
      )[targetCurr]
      set(cachedData, `${sourceCurr}.${targetCurr}`, rate)
      segment?.close()
      return rate
    } catch (e: any) {
      segment?.close(e)
      if (i === MAX_CURRENCY_API_RETRY) {
        logger.error('Failed to fetch the exchange rate!')
        throw e
      } else {
        // Exponential retry
        await new Promise((resolve) => setTimeout(resolve, i ** 2 * 500))
      }
    }
  }
  throw new Error('Not handled')
}

export async function getTargetCurrencyAmount(
  transactionAmountDefails: TransactionAmountDetails,
  targetCurrency: CurrencyCode,
  date?: Date
): Promise<TransactionAmountDetails> {
  const sourceCurrency = transactionAmountDefails.transactionCurrency
  if (sourceCurrency === targetCurrency) {
    return transactionAmountDefails
  }
  const rate = await getCurrencyExchangeRate(
    sourceCurrency,
    targetCurrency,
    date
  )
  return {
    transactionAmount: transactionAmountDefails.transactionAmount * rate,
    transactionCurrency: targetCurrency,
  }
}
