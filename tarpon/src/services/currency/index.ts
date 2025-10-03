import isEmpty from 'lodash/isEmpty'
import mapValues from 'lodash/mapValues'
import set from 'lodash/set'
import { captureException as captureExceptionSentry } from '@sentry/aws-serverless'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { mockedCurrencyExchangeRates } from '../../../test-resources/mocked-currency-exchange-rates'
import { CurrencyRepository } from './repository'
import { DERIVED_CURRENCY_EXCHANGE_RATES } from './derived-exchange-rates'
import { apiFetch } from '@/utils/api-fetch'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { traceable } from '@/core/xray'

const cachedData: Partial<CurrencyExchangeUSDType> = {}

export type Currency = CurrencyCode

let dbCache = false

export function enableDbCache(): void {
  dbCache = true
}

export function disableDbCache(): void {
  dbCache = false
}

export function useDbCache(): void {
  beforeAll(() => {
    enableDbCache()
  })
  afterAll(() => {
    disableDbCache()
  })
}

export type CoinbaseResponse = {
  data: { rates: Record<NonExchangeRateCurrency, string> }
}

export type CurrencyExchangeUSDType = {
  rates: Record<CurrencyCode, number>
  date: string
}

// Currency Codes that are not supported by the Coinbase API Should use USD as the exchange rate
export const CURRENCY_CODES_WITH_NO_EXCHANGE_RATE: CurrencyCode[] = [
  'FDUSD',
  'AGX',
  'AUX',
  'BNB',
  'CUBE',
  'EMON',
  'FDGT',
  'KGLD',
  'LODE',
  'PASS',
  'PREMIA',
  'TAB1',
  'TD-USD',
  'TRX',
  'TYUGA',
  'VIC',
  'XAI',
  'EURT',
  'NPC',
  'EURA',
  'ISLM',
  'KLAY',
  'ZIL',
  'DYDX',
  'IOTA',
  'TON',
  'WAVES',
  'LUNA2',
  'NEO',
] as const

// Currencies to take exchange rate from other currency for Example SLE should take exchange rate of SLL
export type CurrencyToTakeExchangeRateFromOtherCurrency = 'SLE'
export type NonExchangeRateCurrency = Exclude<
  CurrencyCode,
  CurrencyToTakeExchangeRateFromOtherCurrency
>

@traceable
export class CurrencyService {
  repository: CurrencyRepository

  constructor(dynamoDb: DynamoDBDocumentClient) {
    this.repository = new CurrencyRepository(dynamoDb)
  }

  public static parseCoinbaseResponse(
    coinbaseResponse: CoinbaseResponse
  ): CurrencyExchangeUSDType {
    CURRENCY_CODES_WITH_NO_EXCHANGE_RATE.forEach((currency) => {
      coinbaseResponse.data.rates[currency] = coinbaseResponse.data.rates['USD']
    })

    Object.entries(DERIVED_CURRENCY_EXCHANGE_RATES).forEach(
      ([currency, getExchangeRate]) => {
        coinbaseResponse.data.rates[currency] = getExchangeRate(
          coinbaseResponse.data.rates as Record<NonExchangeRateCurrency, string>
        )
      }
    )

    return {
      rates: mapValues(coinbaseResponse.data.rates, parseFloat) as Record<
        CurrencyCode,
        number
      >,
      date: dayjs().format('YYYY-MM-DD'),
    }
  }

  public async getExchangeRates(): Promise<CurrencyExchangeUSDType['rates']> {
    let exchangeData = await this.getCache()

    if (isEmpty(exchangeData) || this.isCacheExpired(exchangeData)) {
      try {
        const cdnData = await this.getExchangeData()
        exchangeData = await this.storeCache(cdnData)
      } catch (e) {
        logger.warn(`Failed to fetch currency exchange data from CDN`, e)

        if (exchangeData?.date) {
          const failureTimestamp = new Date(exchangeData?.date).getTime()
          const diffInHours = (Date.now() - failureTimestamp) / (1000 * 60 * 60)
          if (diffInHours >= 48) {
            captureExceptionSentry(
              `Failed to fetch currency exchange data from CDN for more than 48 hours`
            )
          }
        }
      }
    }

    if (!exchangeData) {
      throw new Error(`Failed to fetch currency exchange data from CDN`)
    }

    return exchangeData.rates
  }

  public async getExchangeData(): Promise<CurrencyExchangeUSDType> {
    if (envIs('local')) {
      return CurrencyService.parseCoinbaseResponse(mockedCurrencyExchangeRates)
    }

    const response = await apiFetch<CoinbaseResponse>(
      `https://api.coinbase.com/v2/exchange-rates?currency=USD`
    )

    return CurrencyService.parseCoinbaseResponse(response.result)
  }

  public async getCurrencyExchangeRate(
    sourceCurrency: Currency,
    targetCurrency: Currency
  ): Promise<number> {
    const exchangeData = await this.getExchangeRates()

    return CurrencyService.getExchangeRate(
      sourceCurrency,
      targetCurrency,
      exchangeData
    )
  }

  public async clearCache(): Promise<void> {
    await this.repository.clearCache()
  }

  private isCacheExpired(exchangeData: CurrencyExchangeUSDType): boolean {
    return (
      dayjs(exchangeData.date).isBefore(dayjs().subtract(1, 'day')) ||
      !exchangeData.rates
    )
  }

  public static getExchangeRate(
    sourceCurrency: Currency,
    targetCurrency: Currency,
    exchangeData: CurrencyExchangeUSDType['rates']
  ): number {
    const sourceCurrencyExchangeRateInUSD = exchangeData[sourceCurrency]
    const targetCurrencyExchangeRateInUSD = exchangeData[targetCurrency]

    const exchangeRate =
      targetCurrencyExchangeRateInUSD / sourceCurrencyExchangeRateInUSD

    return exchangeRate
  }

  public static getTargetCurrencyAmount(
    transactionAmountDetails: TransactionAmountDetails,
    targetCurrency: CurrencyCode,
    exchangeRates: CurrencyExchangeUSDType['rates']
  ): TransactionAmountDetails {
    const sourceCurrency = transactionAmountDetails.transactionCurrency
    if (sourceCurrency === targetCurrency) {
      return transactionAmountDetails
    }

    const rate = CurrencyService.getExchangeRate(
      sourceCurrency,
      targetCurrency,
      exchangeRates
    )

    return {
      transactionAmount: transactionAmountDetails.transactionAmount * rate,
      transactionCurrency: targetCurrency,
    }
  }

  public async getTargetCurrencyAmount(
    transactionAmountDetails: TransactionAmountDetails,
    targetCurrency: CurrencyCode
  ): Promise<TransactionAmountDetails> {
    const exchangeData = await this.getExchangeRates()

    return CurrencyService.getTargetCurrencyAmount(
      transactionAmountDetails,
      targetCurrency,
      exchangeData
    )
  }

  private async getCache(): Promise<CurrencyExchangeUSDType | undefined> {
    if ((envIs('local') || envIs('test')) && !dbCache) {
      return CurrencyService.parseCoinbaseResponse(mockedCurrencyExchangeRates)
    }
    if (!isEmpty(cachedData) && cachedData.date && cachedData.rates) {
      return cachedData as CurrencyExchangeUSDType
    }

    const dynamoCachedData = await this.repository.getCache()
    if (dynamoCachedData && dynamoCachedData.date && dynamoCachedData.rates) {
      set(cachedData, 'date', dynamoCachedData?.date)
      set(cachedData, 'rates', dynamoCachedData?.rates)
    }
    return dynamoCachedData
  }

  public resetLocalCache(): void {
    cachedData.date = undefined
    cachedData.rates = undefined
  }

  private async storeCache(
    cdnData: CurrencyExchangeUSDType
  ): Promise<CurrencyExchangeUSDType> {
    set(cachedData, 'date', cdnData.date)
    set(cachedData, 'rates', cdnData.rates)

    return this.repository.storeCache(cdnData)
  }

  public async expireCache(): Promise<void> {
    return this.repository.expireCache()
  }
}
