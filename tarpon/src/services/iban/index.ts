import pLimit from 'p-limit'
import { electronicFormatIBAN, isValidIBAN } from 'ibantools'
import { IBANApiRepository } from './repositories/iban-api-repository'
import { IBAN_API_PROVIDERS } from './providers'
import { IBANBankInfo } from './types'
import { ApiProvider } from './providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { hasFeature } from '@/core/utils/context'
import { traceable } from '@/core/xray'

const ibanConcurrencyLimit = pLimit(10)

export type BankInfo = { bankName?: string; iban?: string }

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

@traceable
export class IBANService {
  apiKey!: string
  ibanApiRepository!: IBANApiRepository
  tenantId: string
  initializationPromise: Promise<void> | null = null
  providers: ApiProvider[]

  constructor(
    tenantId: string,
    providers = IBAN_API_PROVIDERS.filter((provider) => provider.enabled())
  ) {
    this.tenantId = tenantId
    this.providers = providers
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
    const ibanDetails = new Map<string, IBANBankInfo | null>()
    ibanHistories?.forEach((history) => {
      const rawIban = sanitizedToRawIban.get(history.request.iban)
      if (rawIban) {
        ibanDetails.set(rawIban, history.response)
      }
    })

    // For all the input bankInfos, find the results in the map.
    return await Promise.all(
      bankInfos.map((bankInfo) => {
        return ibanConcurrencyLimit(async () => {
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
      })
    )
  }

  private async queryIban(iban: string): Promise<IBANBankInfo | null> {
    if (this.providers.length === 0) {
      throw new Error('No IBAN providers enabled')
    }
    for (const provider of this.providers) {
      try {
        const { response, rawResponse } = await provider.resolveIban(iban)
        if (provider.cacheable()) {
          await this.ibanApiRepository.saveIbanValidationHistory(
            iban,
            response,
            rawResponse,
            provider.source
          )
        }
        if (response.bankName) {
          // If we cannot get the bank name, we will try the next provider
          return response
        }
      } catch (e) {
        logger.error(
          `Failed to resolve IBAN ${iban} with ${provider.source} - ${e}`
        )
      }
    }
    return null
  }

  public async initializeInternal() {
    const mongoDb = await getMongoDbClient()
    this.ibanApiRepository = new IBANApiRepository(this.tenantId, mongoDb)
  }

  public async initialize() {
    this.initializationPromise =
      this.initializationPromise ?? this.initializeInternal()
    await this.initializationPromise
  }
}
