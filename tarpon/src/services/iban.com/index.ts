// API Reference: https://www.iban.com/validation-api

import { URLSearchParams } from 'url'
import fetch from 'node-fetch'
import _ from 'lodash'
import { electronicFormatIBAN, isValidIBAN } from 'ibantools'
import { IBANValidation, IBANValidationResponse } from './types'
import { IBANApiRepository } from './repositories/iban-api-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getSecret } from '@/utils/secrets-manager'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { logger } from '@/core/logger'
import { hasFeature } from '@/core/utils/context'
import { traceable } from '@/core/xray'

const IBAN_API_URI = 'https://api.iban.com/clients/api/v4/iban/'

export type BankInfo = { bankName?: string; iban?: string }

function ibanValidationResponseToIBANDetails(
  iban: string,
  response: IBANValidationResponse
): IBANDetails | null {
  if (_.isEmpty(response?.bank_data)) {
    return null
  }
  return {
    method: 'IBAN',
    bankName: response.bank_data?.bank,
    BIC: response.bank_data?.bic,
    IBAN: iban,
    bankBranchCode: response.bank_data?.branch_code,
    bankAddress: {
      addressLines: [response.bank_data?.address],
      postcode: response.bank_data?.zip ?? '',
      city: response.bank_data?.city ?? '',
      country: response.bank_data?.country ?? '',
      state: response.bank_data?.state ?? '',
    },
  }
}

function hasAccountError(errors: IBANValidation[]) {
  return Boolean(
    errors.find(
      (error) =>
        error.code === '301' ||
        error.code === '302' ||
        error.code === '303' ||
        error.code === '304' ||
        error.code === '305'
    )
  )
}

function sanitizeAndValidateIban(iban: string): string | null {
  const sanitizedIban = electronicFormatIBAN(iban)
  if (!sanitizedIban) {
    return null
  }
  if (!isValidIBAN(sanitizedIban)) {
    return null
  }
  return sanitizedIban
}

async function getApiKey(): Promise<string> {
  if (process.env.IBAN_API_KEY) {
    return process.env.IBAN_API_KEY
  }
  return (await getSecret<{ apiKey: string }>(
    process.env.IBANCOM_CREDENTIALS_SECRET_ARN as string
  ))!.apiKey
}

@traceable
export class IBANService {
  apiKey!: string
  ibanApiRepository!: IBANApiRepository
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async resolveBankNames(bankInfos: BankInfo[]): Promise<BankInfo[]> {
    await this.initialize()

    if (!hasFeature('IBAN_RESOLUTION')) {
      logger.error(`IBAN_RESOLUTION feature flag required to resolve bank name`)
      return bankInfos
    }

    const sanitizedToRawIban = new Map<string, string>()

    // Sanitize IBANs
    const sanitizedIbans = bankInfos
      .map((bankInfo) => {
        if (bankInfo.iban) {
          const iban = sanitizeAndValidateIban(bankInfo.iban)
          if (iban) {
            sanitizedToRawIban.set(iban, bankInfo.iban)
            return iban
          } else {
            logger.warn(`'${iban}' is not a valid IBAN (ibantools)`)
          }
        }
      })
      .filter((iban): iban is string => !!iban)

    // Get IBAN validation histories for the sanitized IBANS
    const ibanHistories =
      await this.ibanApiRepository.getLatestIbanValidationHistories(
        sanitizedIbans
      )

    // Convert the IBAN histories to details
    const ibanDetails = new Map<string, IBANDetails | null>()
    ibanHistories?.forEach((history) => {
      const rawIban = sanitizedToRawIban.get(history.request.iban)
      if (rawIban) {
        ibanDetails.set(
          rawIban,
          ibanValidationResponseToIBANDetails(
            history.request.iban,
            history.response
          )
        )
      }
    })

    // For all the input bankInfos, find the results in the map.
    return await Promise.all(
      bankInfos.map(async (bankInfo) => {
        if (bankInfo.iban) {
          const ibanDetail = ibanDetails.get(bankInfo.iban)
          if (ibanDetail) {
            bankInfo.bankName = ibanDetail.bankName
          } else {
            const sanitized = sanitizeAndValidateIban(bankInfo.iban)
            if (sanitized) {
              const ibanDetail = await this.queryIban(sanitized)
              bankInfo.bankName = ibanDetail?.bankName
            }
          }
        }
        return bankInfo
      })
    )
  }

  private async queryIban(iban: string): Promise<IBANDetails | null> {
    const rawIbanResponse = (await (
      await fetch(IBAN_API_URI, {
        method: 'POST',
        headers: {
          'User-Agent': 'IBAN API Client/0.0.1',
        },
        body: this.getRequestBody({ iban }),
      })
    ).json()) as IBANValidationResponse

    if (hasAccountError(rawIbanResponse.errors ?? [])) {
      throw new Error(
        `Fail to access IBAN.com API: ${JSON.stringify(rawIbanResponse.errors)}`
      )
    }
    await this.ibanApiRepository.saveIbanValidationHistory(
      iban,
      rawIbanResponse
    )
    const result = ibanValidationResponseToIBANDetails(iban, rawIbanResponse)
    if (!result) {
      logger.error(
        `'${iban}' is not a valid IBAN (${JSON.stringify(
          rawIbanResponse.validations
        )})`
      )
    }
    return result
  }

  public async initialize() {
    if (this.apiKey) {
      return
    }
    const mongoDb = await getMongoDbClient()
    this.ibanApiRepository = new IBANApiRepository(this.tenantId, mongoDb)
    this.apiKey = await getApiKey()
  }

  private getRequestBody(request: { [key: string]: string }): URLSearchParams {
    const params = new URLSearchParams()
    params.append('api_key', this.apiKey)
    params.append('format', 'json')
    for (const key in request) {
      params.append(key, request[key])
    }
    return params
  }
}
