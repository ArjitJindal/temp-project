import { JSONSchemaType } from 'ajv'
import pLimit from 'p-limit'

import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  IS_ACTIVE_SCHEMA,
  PARTIAL_MATCH_SCHEMA,
  USER_RULE_STAGE_SCHEMA,
  SCREENING_PROFILE_ID_SCHEMA,
  ENABLE_SHORT_NAME_MATCHING_SCHEMA,
  GENERIC_SCREENING_VALUES_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import {
  getEnableShortNameMatchingParameters,
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { GenericScreeningValues } from './generic-sanctions-consumer-user'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { User } from '@/@types/openapi-public/User'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { Address } from '@/@types/openapi-public/Address'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'

const caConcurrencyLimit = pLimit(10)

type BankInfo = { bankName?: string; iban?: string; address?: Address }

export type SanctionsBankUserRuleParameters = {
  screeningTypes?: GenericSanctionsSearchType[]
  ruleStages: UserRuleStage[]
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  screeningValues?: GenericScreeningValues[]
  enableShortNameMatching?: boolean
}

export default class SanctionsBankUserRule extends UserRule<SanctionsBankUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsBankUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA(),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        enableShortNameMatching: ENABLE_SHORT_NAME_MATCHING_SCHEMA(),
        ruleStages: USER_RULE_STAGE_SCHEMA({
          description:
            'Select specific stage(s) of the user lifecycle that this rule will run for',
        }),
        screeningValues: GENERIC_SCREENING_VALUES_SCHEMA(
          {
            description:
              'Select the screening attributes to be used for the screening',
          },
          ['ADDRESS']
        ),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
        isActive: IS_ACTIVE_SCHEMA,
        partialMatch: PARTIAL_MATCH_SCHEMA,
        screeningProfileId: SCREENING_PROFILE_ID_SCHEMA(),
      },
      required: [
        'fuzziness',
        'fuzzinessSetting',
        'ruleStages',
        'screeningProfileId',
      ],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const {
      fuzziness,
      screeningTypes,
      ruleStages,
      fuzzinessSetting,
      stopwords,
      isActive,
      partialMatch,
      screeningProfileId,
      enableShortNameMatching,
      screeningValues,
    } = this.parameters
    const fuzzyAddressMatching = screeningValues?.includes('ADDRESS')
    if (
      ruleStages &&
      ruleStages.length > 0 &&
      !ruleStages.includes(this.stage)
    ) {
      return
    }
    const user = this.user as User
    const bankInfos = (user.savedPaymentDetails || [])
      ?.map((paymentDetails) => {
        if (paymentDetails.method === 'IBAN') {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.IBAN,
            address: paymentDetails.bankAddress,
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
            address: paymentDetails.bankAddress,
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
                monitoring: { enabled: this.stage === 'ONGOING' },
                ...getEntityTypeForSearch('BANK'),
                ...getFuzzinessSettings(fuzzinessSetting),
                ...getStopwordSettings(stopwords),
                ...getIsActiveParameters(screeningTypes, isActive),
                ...getPartialMatchParameters(partialMatch),
                ...(providers.includes(SanctionsDataProviders.ACURIS)
                  ? { screeningProfileId: screeningProfileId ?? undefined }
                  : {}),
                ...getFuzzyAddressMatchingParameters(
                  providers,
                  fuzzyAddressMatching,
                  bankInfo.address ? [bankInfo.address] : undefined
                ),
                ...getEnableShortNameMatchingParameters(
                  enableShortNameMatching
                ),
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
