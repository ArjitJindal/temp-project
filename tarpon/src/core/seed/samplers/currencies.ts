import { CRYPTO_CURRENCIES_KEYS } from '@flagright/lib/constants'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

const _SAMPLE_CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP']
export const SAMPLE_CURRENCIES = _SAMPLE_CURRENCIES as CurrencyCode[]

export const CRYPTO_CURRENCIES = CRYPTO_CURRENCIES_KEYS as CurrencyCode[]
