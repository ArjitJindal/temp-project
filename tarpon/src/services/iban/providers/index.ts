import { ApiNinjasProvider } from './apininjas'
import { IbanApiProvider } from './ibanapi'
import { OpenIbanProvider } from './openiban'

export const IBAN_API_PROVIDERS = [
  // The order here is important - the first provider that returns a valid response will be used
  new IbanApiProvider(),
  new ApiNinjasProvider(),
  new OpenIbanProvider(),
]
