import { isEmpty, mapValues, set } from 'lodash'
import * as Sentry from '@sentry/serverless'
import { mockedCurrencyExchangeRates } from '../../../test-resources/mocked-currency-exchange-rates'
import { CurrencyRepository } from './repository'
import { apiFetch } from '@/utils/api-fetch'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'

const cachedData: Partial<CurrencyExchangeUSDType> = {}

export type Currency = string

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
  data: {
    rates: Record<CurrencyCode, string>
  }
}

export type CurrencyExchangeUSDType = {
  rates: Record<CurrencyCode, number>
  date: string
}

export class CurrencyService {
  repository: CurrencyRepository

  constructor() {
    this.repository = new CurrencyRepository()
  }

  public static parseCoinbaseResponse(
    coinbaseResponse: CoinbaseResponse
  ): CurrencyExchangeUSDType {
    return {
      rates: mapValues(coinbaseResponse.data.rates, parseFloat) as Record<
        CurrencyCode,
        number
      >,
      date: dayjs().format('YYYY-MM-DD'),
    }
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
            Sentry.captureMessage(
              `Failed to fetch currency exchange data from CDN for more than 48 hours`
            )
          }
        }
      }
    }

    if (!exchangeData) {
      throw new Error(`Failed to fetch currency exchange data from CDN`)
    }

    return this.getExchangeRate(sourceCurrency, targetCurrency, exchangeData)
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

  private getExchangeRate(
    sourceCurrency: Currency,
    targetCurrency: Currency,
    exchangeData: CurrencyExchangeUSDType
  ): number {
    const sourceCurrencyExchangeRateInUSD = exchangeData.rates[sourceCurrency]
    const targetCurrencyExchangeRateInUSD = exchangeData.rates[targetCurrency]

    const exchangeRate =
      targetCurrencyExchangeRateInUSD / sourceCurrencyExchangeRateInUSD

    return exchangeRate
  }

  public async getTargetCurrencyAmount(
    transactionAmountDetails: TransactionAmountDetails,
    targetCurrency: CurrencyCode
  ): Promise<TransactionAmountDetails> {
    const sourceCurrency = transactionAmountDetails.transactionCurrency
    if (sourceCurrency === targetCurrency) {
      return transactionAmountDetails
    }

    const rate = await this.getCurrencyExchangeRate(
      sourceCurrency,
      targetCurrency
    )

    return {
      transactionAmount: transactionAmountDetails.transactionAmount * rate,
      transactionCurrency: targetCurrency,
    }
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
