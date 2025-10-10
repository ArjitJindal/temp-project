import fs from 'fs'
import path from 'path'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { apiFetch } from '@/utils/api-fetch'

const CURRENCY_CODES_TO_FETCH: CurrencyCode[] = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'INR',
  'PKR',
  'TRY',
  'RUB',
  'AFN',
  'AED',
  'SGD',
  'BHD',
  'TWD',
]

async function main() {
  const allCurrencies = CURRENCY_CODES_TO_FETCH
  const allCurrenciesWithRates: Partial<
    Record<string, Record<string, number>>
  > = {}

  for await (const currency of allCurrencies) {
    console.log(`Fetching ${currency}...`)
    const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${currency.toLowerCase()}.min.json`
    const data = (await apiFetch<object>(url)).result
    const currencyData = data[currency.toLowerCase()]
    const capitalizedData = Object.keys(currencyData).reduce((acc, key) => {
      if (
        CURRENCY_CODES_TO_FETCH.includes(key.toUpperCase() as CurrencyCode) &&
        key.toUpperCase() !== currency
      ) {
        acc[key.toUpperCase()] = currencyData[key]
      }
      return acc
    }, {})
    allCurrenciesWithRates[currency] = capitalizedData
    console.log(`Fetched ${currency}`)
  }

  fs.writeFileSync(
    path.join(
      __dirname,
      '..',
      'test-resources',
      'mocked-currency-exchange-rates.json'
    ),
    JSON.stringify(allCurrenciesWithRates, null, 2)
  )
}

void main()
