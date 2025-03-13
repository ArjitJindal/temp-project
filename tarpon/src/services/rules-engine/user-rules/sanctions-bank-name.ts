import { JSONSchemaType } from 'ajv'
import pLimit from 'p-limit'

import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import {
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { User } from '@/@types/openapi-public/User'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'

const caConcurrencyLimit = pLimit(10)

type BankInfo = { bankName?: string; iban?: string }

export type SanctionsBankUserRuleParameters = {
  screeningTypes?: SanctionsSearchType[]
  ongoingScreening: boolean
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
  stopwords?: string[]
}

export default class SanctionsBankUserRule extends UserRule<SanctionsBankUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsBankUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA(),
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing bank names after it is enabled.',
        }),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
      },
      required: ['fuzziness', 'fuzzinessSetting'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const {
      fuzziness,
      screeningTypes,
      ongoingScreening,
      fuzzinessSetting,
      stopwords,
    } = this.parameters

    if (this.ongoingScreeningMode && !ongoingScreening) {
      return
    }
    const user = this.user as User
    const bankInfos = (user.savedPaymentDetails || [])
      ?.map((paymentDetails) => {
        if (paymentDetails.method === 'IBAN') {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.IBAN,
          }
        }
        if (
          paymentDetails.method === 'GENERIC_BANK_ACCOUNT' ||
          paymentDetails.method === 'ACH' ||
          paymentDetails.method === 'SWIFT'
        ) {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.accountNumber,
          }
        }
      })
      .filter(Boolean) as BankInfo[]

    const providers = getDefaultProviders()

    const bankInfosToCheck = uniqBy(
      bankInfos.filter((bankInfo) => bankInfo.bankName),
      (bankInfo) => JSON.stringify(bankInfo)
    )

    const hitResult: RuleHitResult = []
    const sanctionsDetails: (SanctionsDetails | undefined)[] =
      await Promise.all(
        bankInfosToCheck.map((bankInfo) =>
          caConcurrencyLimit(async () => {
            const bankName = bankInfo.bankName
            if (!bankName) {
              return
            }
            const hitContext = {
              entity: 'BANK' as const,
              userId: this.user.userId,
              ruleInstanceId: this.ruleInstance.id ?? '',
              iban: bankInfo.iban,
              isOngoingScreening: this.ongoingScreeningMode,
              searchTerm: bankName,
            }
            const result = await this.sanctionsService.search(
              {
                searchTerm: bankName,
                types: screeningTypes,
                fuzziness: fuzziness / 100,
                monitoring: { enabled: ongoingScreening },
                ...getEntityTypeForSearch(providers, 'BANK'),
                ...getFuzzinessSettings(providers, fuzzinessSetting),
                ...getStopwordSettings(providers, stopwords),
              },
              hitContext
            )
            let sanctionsDetails: SanctionsDetails
            if (result.hitsCount > 0) {
              sanctionsDetails = {
                name: bankName,
                iban: bankInfo.iban,
                searchId: result.searchId,
                hitContext,
              }
              return sanctionsDetails
            }
          })
        )
      )

    const filteredSanctionsDetails = sanctionsDetails.filter(
      (searchResponse): searchResponse is SanctionsDetails => !!searchResponse
    )

    if (filteredSanctionsDetails.length > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails: filteredSanctionsDetails,
      })
    }
    return hitResult
  }
}
