/*
API Reference: https://ibanapi.com/get-api
Example Response:
{
  "result": 200,
  "message": "Valid IBAN Number",
  "validations": [
    {
      "result": 200,
      "message": "Valid IBAN length"
    },
    {
      "result": 200,
      "message": "Valid IBAN Checksum"
    },
    {
      "result": 200,
      "message": "Valid IBAN Structure"
    }
  ],
  "expremental": 0,
  "data": {
    "country_code": "MT",
    "iso_alpha3": "MLT",
    "country_name": "Malta",
    "currency_code": "EUR",
    "sepa_member": "Yes",
    "sepa": {
      "sepa_credit_transfer": "Yes",
      "sepa_direct_debit": "Yes",
      "sepa_sdd_core": "No",
      "sepa_b2b": "Yes",
      "sepa_card_clearing": "No"
    },
    "bban": "MMEB44093000000009027293051",
    "bank_account": "000000009027293051",
    "bank": {
      "bank_name": "HSBC Bank Malta plc.",
      "phone": "",
      "address": "",
      "bic": "MMEBMTMT",
      "city": "St. Andrew's",
      "state": "",
      "zip": ""
    }
  }
}
*/

import { IBANBankInfo } from '../types'
import { ApiProvider } from './types'
import { getSecretByName } from '@/utils/secrets-manager'
import { apiFetch } from '@/utils/api-fetch'
import { envIs } from '@/utils/env'

type Validation = {
  result: number
  message: string
}

type SepaInfo = {
  sepa_credit_transfer: string
  sepa_direct_debit: string
  sepa_sdd_core: string
  sepa_b2b: string
  sepa_card_clearing: string
}

type BankInfo = {
  bank_name: string
  phone: string
  address: string
  bic: string
  city: string
  state: string
  zip: string
}

type IBANInfo = {
  country_code?: string
  iso_alpha3?: string
  country_name?: string
  currency_code?: string
  sepa_member?: string
  sepa?: SepaInfo
  bban?: string
  bank_account?: string
  bank?: BankInfo
}

type IBANResponse = {
  result: number
  message: string
  validations: Validation[]
  expremental: number
  data?: IBANInfo
}

export class IbanApiProvider implements ApiProvider {
  source = 'ibanapi.com'

  enabled(): boolean {
    return envIs('prod')
  }
  cacheable(): boolean {
    return true
  }

  async resolveIban(
    iban: string
  ): Promise<{ response: IBANBankInfo; rawResponse: object }> {
    const apiKey = (await getSecretByName('ibanapiCreds'))?.apiKey
    const { result } = await apiFetch<IBANResponse>(
      `https://api.ibanapi.com/v1/validate/${iban}?api_key=${apiKey}`
    )
    if (result.result === 401) {
      throw new Error('Invalid API key!')
    }
    return {
      response:
        result.result === 200
          ? {
              bankName: result.data?.bank?.bank_name,
              bic: result.data?.bank?.bic,
              address: result.data?.bank?.address,
              zip: result.data?.bank?.zip,
              city: result.data?.bank?.city,
              country: result.data?.country_name,
              state: result.data?.bank?.state,
            }
          : {},
      rawResponse: result,
    }
  }
}
