import { mockedCurrencyExchangeRates as MOCKED_CURRENCY_EXCHANGE_RATES } from '../../../test-resources/mocked-currency-exchange-rates'

import { CurrencyService } from '@/services/currency'
import * as ApiFetch from '@/utils/api-fetch'
import * as DynamoDb from '@/utils/dynamodb'

describe('Test Currency Utils', () => {
  const currencyService = new CurrencyService()

  beforeAll(async () => {
    jest.resetAllMocks()
  })

  beforeEach(async () => {
    await currencyService.clearCache()
  })

  test('Test CDN is called', async () => {
    jest.spyOn(CurrencyService.prototype, 'getExchangeData').mockRestore()
    const mockCDNGet = jest.spyOn(ApiFetch, 'apiFetch')
    const mockDynamoDbGet = jest.spyOn(DynamoDb, 'getDynamoDbClient')

    mockCDNGet.mockResolvedValue(
      Promise.resolve({
        result: MOCKED_CURRENCY_EXCHANGE_RATES,
        statusCode: 200,
      })
    )

    const exchangeRate = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    // Cache is missing, CDN is called
    expect(mockCDNGet).toHaveBeenCalledTimes(1)
    expect(exchangeRate).toEqual(
      parseFloat(MOCKED_CURRENCY_EXCHANGE_RATES.data.rates.INR) /
        parseFloat(MOCKED_CURRENCY_EXCHANGE_RATES.data.rates.EUR)
    )
    expect(mockDynamoDbGet).toHaveBeenCalledTimes(2)

    // Cache is present, CDN is not called
    mockCDNGet.mockClear()
    mockDynamoDbGet.mockClear()
    const exchangeRate2 = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    expect(mockCDNGet).toHaveBeenCalledTimes(0)
    expect(exchangeRate2).toEqual(exchangeRate)
    expect(mockDynamoDbGet).toHaveBeenCalledTimes(0)

    // Clear In-Memory Cache and Check CDN is not called
    mockCDNGet.mockClear()
    mockDynamoDbGet.mockClear()

    currencyService.resetLocalCache()

    const exchangeRate3 = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    expect(mockCDNGet).toHaveBeenCalledTimes(0)
    expect(exchangeRate3).toEqual(exchangeRate)
    expect(mockDynamoDbGet).toHaveBeenCalledTimes(1)

    mockCDNGet.mockRestore()

    // Fail API Call Still returns cached value
    const mockCDNGet2 = jest.spyOn(ApiFetch, 'apiFetch')
    await currencyService.expireCache()

    mockDynamoDbGet.mockClear()
    currencyService.resetLocalCache()

    mockCDNGet2.mockRejectedValue(
      new Error('Failed to fetch currency exchange data')
    )

    const exchangeRate4 = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    expect(mockCDNGet2).toHaveBeenCalledTimes(1)
    expect(exchangeRate4).toEqual(exchangeRate)
    expect(mockDynamoDbGet).toHaveBeenCalledTimes(1)
  })
})
