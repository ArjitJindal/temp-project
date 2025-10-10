import {
  CurrencyToTakeExchangeRateFromOtherCurrency,
  NonExchangeRateCurrency,
} from '.'

export const DERIVED_CURRENCY_EXCHANGE_RATES: Record<
  CurrencyToTakeExchangeRateFromOtherCurrency,
  (exchangeRates: Record<NonExchangeRateCurrency, string>) => number
> = {
  SLE: (exchangeRates: Record<NonExchangeRateCurrency, string>) => {
    // 1 SLE === 1000 SLL
    return parseFloat(exchangeRates['SLL']) / 1000
  },
}
