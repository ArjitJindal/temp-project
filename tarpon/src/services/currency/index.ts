import { isEmpty, set } from 'lodash'
import * as Sentry from '@sentry/serverless'
import { CurrencyRepository } from './repository'
import { apiFetch } from '@/utils/api-fetch'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import dayjs from '@/utils/dayjs'

const cachedData: Partial<CurrencyExchangeUSDType> = {}

export type Currency = string

export type CurrencyExchangeUSDType = {
  date: string
  usd: Record<Lowercase<Currency>, number>
}

export class CurrencyService {
  repository: CurrencyRepository

  constructor() {
    this.repository = new CurrencyRepository()
  }

  public async getExchangeData(): Promise<CurrencyExchangeUSDType> {
    const data = await apiFetch<CurrencyExchangeUSDType>(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/${dayjs().format(
        'YYYY-MM-DD'
      )}/currencies/usd.min.json`
    )

    logger.info(`Fetched currency exchange data from CDN`)
    return data.result
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
    return dayjs(exchangeData.date).isBefore(dayjs().subtract(1, 'day'))
  }

  private getExchangeRate(
    sourceCurrency: Currency,
    targetCurrency: Currency,
    exchangeData: CurrencyExchangeUSDType
  ): number {
    const sourceCurrencyCode =
      sourceCurrency.toLowerCase() as Lowercase<Currency>
    const targetCurrencyCode =
      targetCurrency.toLowerCase() as Lowercase<Currency>

    const sourceCurrencyExchangeRateInUSD = exchangeData.usd[sourceCurrencyCode]
    const targetCurrencyExchangeRateInUSD = exchangeData.usd[targetCurrencyCode]

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
    if (!isEmpty(cachedData) && cachedData.date && cachedData.usd) {
      return cachedData as CurrencyExchangeUSDType
    }

    const dynamoCachedData = await this.repository.getCache()
    if (dynamoCachedData && dynamoCachedData.date && dynamoCachedData.usd) {
      set(cachedData, 'date', dynamoCachedData?.date)
      set(cachedData, 'usd', dynamoCachedData?.usd)
    }
    return dynamoCachedData
  }

  public resetLocalCache(): void {
    cachedData.date = undefined
    cachedData.usd = undefined
  }

  private async storeCache(
    cdnData: CurrencyExchangeUSDType
  ): Promise<CurrencyExchangeUSDType> {
    set(cachedData, 'date', cdnData.date)
    set(cachedData, 'usd', cdnData.usd)

    return this.repository.storeCache(cdnData)
  }

  public async expireCache(): Promise<void> {
    return this.repository.expireCache()
  }
}
