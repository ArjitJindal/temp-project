/*
API Reference: https://api-ninjas.com/api/iban
Example Response:
{
  "iban": "CY21002001950000357001234567",
  "bank_name": "BANK OF CYPRUS PUBLIC COMPANY LIMITED",
  "account_number": "0000357001234567",
  "bank_code": "002",
  "country": "CY",
  "checksum": "21",
  "valid": true,
  "bban": "002001950000357001234567"
}
*/

import { IBANBankInfo } from '../types'
import { ApiProvider } from './types'
import { getSecretByName } from '@/utils/secrets-manager'
import { apiFetch } from '@/utils/api-fetch'
import { envIsNot } from '@/utils/env'

type IBANResponse = {
  iban: string
  bank_name: string
  account_number: string
  bank_code: string
  country: string
  checksum: string
  valid: boolean
  bban: string
  error?: string
}

export class ApiNinjasProvider implements ApiProvider {
  source = 'api-ninjas.com'

  enabled(): boolean {
    // The current free tier doesn't allow commercial use, so we only use it in non-prod environments
    return envIsNot('prod')
  }
  cacheable(): boolean {
    return true
  }

  async resolveIban(
    iban: string
  ): Promise<{ response: IBANBankInfo; rawResponse: object }> {
    const apiKey = (await getSecretByName('apininjasCreds'))?.apiKey
    const { result } = await apiFetch<IBANResponse>(
      `https://api.api-ninjas.com/v1/iban?iban=${iban}`,
      { headers: { 'X-Api-Key': apiKey } }
    )
    if (result.error) {
      throw new Error(result.error)
    }
    return {
      response: result.valid
        ? {
            bankName: result.bank_name,
            branchCode: result.bank_code,
            country: result.country,
          }
        : {},
      rawResponse: result,
    }
  }
}
