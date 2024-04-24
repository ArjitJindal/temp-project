/*
API Reference: https://openiban.com/
Example Response:
{
 "valid": true,
 "messages": [
  "Bank code valid: 51210800"
 ],
 "iban": "DE75512108001245126199",
 "bankData": {
  "bankCode": "51210800",
  "name": "Societe Generale",
  "zip": "60311",
  "city": "Frankfurt am Main",
  "bic": "SOGEDEFFXXX"
 },
 "checkResults": {
  "bankCode": true
 }
}
*/

import { IBANBankInfo } from '../types'
import { ApiProvider } from './types'
import { apiFetch } from '@/utils/api-fetch'

type BankData = {
  bankCode?: string
  name?: string
  zip?: string
  city?: string
  bic?: string
}

type IBANResponse = {
  valid: boolean
  messages: string[]
  iban: string
  bankData?: BankData
}

export class OpenIbanProvider implements ApiProvider {
  source = 'openiban.com'

  enabled(): boolean {
    return true
  }
  cacheable(): boolean {
    return false
  }

  async resolveIban(
    iban: string
  ): Promise<{ response: IBANBankInfo; rawResponse: object }> {
    const { result } = await apiFetch<IBANResponse>(
      `https://openiban.com/validate/${iban}?getBIC=true&validateBankCode=true`
    )
    return {
      response: result.valid
        ? {
            bankName: result.bankData?.name,
            bic: result.bankData?.bic,
            branchCode: result.bankData?.bankCode,
            zip: result.bankData?.zip,
            city: result.bankData?.city,
          }
        : {},
      rawResponse: result,
    }
  }
}
