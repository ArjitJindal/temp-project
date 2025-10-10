import { mockedCurrencyExchangeRates as MOCKED_CURRENCY_EXCHANGE_RATES } from '../../../test-resources/mocked-currency-exchange-rates'
import { getDynamoDbClient } from '../dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CurrencyService, useDbCache } from '@/services/currency'
import * as ApiFetch from '@/utils/api-fetch'

dynamoDbSetupHook()

describe('Test Currency Utils', () => {
  useDbCache()
  const dynamoDb = getDynamoDbClient()
  const currencyService = new CurrencyService(dynamoDb)

  beforeAll(async () => {
    jest.resetAllMocks()
  })

  beforeEach(async () => {
    await currencyService.clearCache()
  })

  test('Test CDN is called', async () => {
    jest.spyOn(CurrencyService.prototype, 'getExchangeData').mockRestore()
    const mockCDNGet = jest.spyOn(ApiFetch, 'apiFetch')

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

    // Cache is present, CDN is not called
    mockCDNGet.mockClear()
    const exchangeRate2 = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    expect(mockCDNGet).toHaveBeenCalledTimes(0)
    expect(exchangeRate2).toEqual(exchangeRate)

    // Clear In-Memory Cache and Check CDN is not called
    mockCDNGet.mockClear()

    currencyService.resetLocalCache()

    const exchangeRate3 = await currencyService.getCurrencyExchangeRate(
      'EUR',
      'INR'
    )

    expect(mockCDNGet).toHaveBeenCalledTimes(0)
    expect(exchangeRate3).toEqual(exchangeRate)

    mockCDNGet.mockRestore()

    // Fail API Call Still returns cached value
    const mockCDNGet2 = jest.spyOn(ApiFetch, 'apiFetch')
    await currencyService.expireCache()

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
  })
})
