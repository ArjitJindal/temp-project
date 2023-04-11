// API Reference: https://www.iban.com/validation-api

import { URLSearchParams } from 'url'
import { Forbidden } from 'http-errors'
import fetch from 'node-fetch'
import _ from 'lodash'
import { electronicFormatIBAN, isValidIBAN } from 'ibantools'
import { IBANValidation, IBANValidationResponse } from './types'
import { IBANApiRepository } from './repositories/iban-api-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getSecret } from '@/utils/secrets-manager'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { logger } from '@/core/logger'

const IBAN_API_URI = 'https://api.iban.com/clients/api/v4/iban/'

const IBANCOM_CREDENTIALS_SECRET_ARN = process.env
  .IBANCOM_CREDENTIALS_SECRET_ARN as string

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
export class IBANService {
  initPromise: Promise<void>
  apiKey!: string
  ibanApiRepository!: IBANApiRepository
  tenantId: string

  constructor(tenantId: string) {
    this.initPromise = this.initialize(tenantId)
    this.tenantId = tenantId
  }

  private async initialize(tenantId: string) {
    if (!(await tenantHasFeature(tenantId, 'IBAN_RESOLUTION'))) {
      throw new Forbidden('IBAN_RESOLUTION feature is required')
    }
    const mongoDb = await getMongoDbClient()
    this.ibanApiRepository = new IBANApiRepository(tenantId, mongoDb)
    this.apiKey = await this.getApiKey()
  }

  public async validateIBAN(
    rawIban: string,
    force = false
  ): Promise<IBANDetails | null> {
    await this.initPromise
    const iban = sanitizeAndValidateIban(rawIban)
    if (!iban) {
      logger.error(`'${rawIban}' is not a valid IBAN (ibantools)`)
      return null
    }

    if (!force) {
      const result =
        await this.ibanApiRepository.getLatestIbanValidationHistory(iban)
      if (result) {
        return ibanValidationResponseToIBANDetails(iban, result.response)
      }
    }

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
        `'${rawIban}' is not a valid IBAN (${JSON.stringify(
          rawIbanResponse.validations
        )})`
      )
    }
    return result
  }

  private async getApiKey(): Promise<string> {
    if (process.env.IBAN_API_KEY) {
      return process.env.IBAN_API_KEY
    }
    return (await getSecret<{ apiKey: string }>(
      IBANCOM_CREDENTIALS_SECRET_ARN
    ))!.apiKey
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
