import { JSONSchemaType } from 'ajv'
import compact from 'lodash/compact'
import uniqBy from 'lodash/uniqBy'
import {
  ENABLE_SHORT_NAME_MATCHING_SCHEMA,
  ENABLE_PHONETIC_MATCHING_SCHEMA,
  FUZZINESS_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  FUZZY_ADDRESS_MATCHING_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  GENERIC_SCREENING_VALUES_SCHEMA,
  IS_ACTIVE_SCHEMA,
  PARTIAL_MATCH_SCHEMA,
  PAYMENT_DETAILS_SCREENING_FIELDS_SCHEMA,
  SCREENING_PROFILE_ID_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
  TRANSACTION_RULE_STAGE_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleResult } from '../rule'
import {
  getEnablePhoneticMatchingParameters,
  getEnableShortNameMatchingParameters,
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getScreeningValues,
  getStopwordSettings,
} from '../utils/rule-utils'
import { GenericScreeningValues } from '../user-rules/generic-sanctions-consumer-user'
import { SanctionsRuleResult } from '../user-rules/sanctions-bank-name'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import {
  extractBankInfoFromPaymentDetails,
  getPaymentDetailsName,
} from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { notNullish } from '@/utils/array'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { getPaymentMethodId } from '@/utils/payment-details'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
import { TransactionRuleStage } from '@/@types/openapi-internal/TransactionRuleStage'
import { RuleExecutionSanctionsDetails } from '@/@types/openapi-public/RuleExecutionSanctionsDetails'

export type ScreeningField = 'NAME' | 'BANK_NAME'
export const SCREENING_FIELDS: ScreeningField[] = ['NAME', 'BANK_NAME']

export type PaymentDetailsScreeningRuleParameters = {
  screeningFields: ScreeningField[]
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: GenericSanctionsSearchType[]
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  screeningValues?: GenericScreeningValues[]
  fuzzyAddressMatching?: boolean
  enableShortNameMatching?: boolean
  enablePhoneticMatching?: boolean
  ruleStages: TransactionRuleStage[]
}

@traceable
export abstract class PaymentDetailsScreeningRuleBase extends TransactionRule<PaymentDetailsScreeningRuleParameters> {
  public static getSchema(): JSONSchemaType<PaymentDetailsScreeningRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningFields: PAYMENT_DETAILS_SCREENING_FIELDS_SCHEMA({
          description: 'The fields to screen from payment details',
        }),
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA({}),
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA({
          multipleOf: 1,
        }),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        enableShortNameMatching: ENABLE_SHORT_NAME_MATCHING_SCHEMA(),
        enablePhoneticMatching: ENABLE_PHONETIC_MATCHING_SCHEMA(),
        screeningProfileId: SCREENING_PROFILE_ID_SCHEMA(),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
        isActive: IS_ACTIVE_SCHEMA,
        partialMatch: PARTIAL_MATCH_SCHEMA,
        screeningValues: GENERIC_SCREENING_VALUES_SCHEMA(
          {
            description:
              'Select the screening attributes to be used for the screening',
          },
          ['YOB', 'NATIONALITY']
        ),
        ruleStages: TRANSACTION_RULE_STAGE_SCHEMA({
          description:
            'Select specific stage(s) of the transaction lifecycle that this rule will run for',
        }),
        fuzzyAddressMatching: FUZZY_ADDRESS_MATCHING_SCHEMA,
      },
      required: [
        'fuzziness',
        'fuzzinessSetting',
        'screeningFields',
        'screeningProfileId',
      ],
      additionalProperties: false,
    }
  }

  abstract computeRule(): Promise<RuleResult>

  public async checkCounterPartyTransaction(
    paymentDetails: PaymentDetails,
    user?: User | Business
  ): Promise<{
    ruleHitSanctionsDetails: SanctionsDetails[]
    ruleExecutionSanctionsDetails?: RuleExecutionSanctionsDetails[]
  }> {
    const {
      fuzziness,
      fuzzinessSetting,
      stopwords,
      isActive,
      screeningTypes,
      screeningFields,
      partialMatch,
      screeningProfileId,
      screeningValues,
      fuzzyAddressMatching,
      enableShortNameMatching,
      enablePhoneticMatching,
    } = this.parameters
    const namesToSearch = screeningFields.includes('NAME')
      ? getPaymentDetailsName(paymentDetails)
      : []

    const bankInfos = screeningFields.includes('BANK_NAME')
      ? compact(extractBankInfoFromPaymentDetails(paymentDetails))
      : []

    const namesToSearchFiltered = uniqBy(namesToSearch, (item) => item.name)
    const providers = getDefaultProviders()
    const data: (SanctionsRuleResult | undefined)[] = await Promise.all([
      ...namesToSearchFiltered.map(
        async (paymentDetail): Promise<SanctionsRuleResult | undefined> => {
          const paymentMethodId = getPaymentMethodId(paymentDetails)
          const hitContext = {
            entity: 'EXTERNAL_USER' as const,
            ruleInstanceId: this.ruleInstance.id ?? '',
            ruleId: this.ruleInstance.ruleId ?? '',
            transactionId: this.transaction.transactionId,
            userId: user?.userId ?? paymentMethodId,
            searchTerm: paymentDetail.name,
            entityType: paymentDetail.entityType,
            paymentMethodId,
          }
          const result = await this.sanctionsService.search(
            {
              searchTerm: paymentDetail.name,
              types: this.parameters.screeningTypes || [],
              fuzziness: fuzziness / 100,
              monitoring: {
                enabled: false,
              },
              ...(providers.includes(SanctionsDataProviders.ACURIS)
                ? { screeningProfileId: screeningProfileId ?? undefined }
                : {}),
              ...getFuzzinessSettings(fuzzinessSetting),
              ...getEntityTypeForSearch('EXTERNAL_USER'),
              ...getStopwordSettings(stopwords),
              ...getIsActiveParameters(screeningTypes, isActive),
              ...getPartialMatchParameters(partialMatch),
              ...getScreeningValues(screeningValues, paymentDetail),
              ...getFuzzyAddressMatchingParameters(
                providers,
                fuzzyAddressMatching,
                paymentDetail.address ? [paymentDetail.address] : undefined
              ),
              ...getEnableShortNameMatchingParameters(enableShortNameMatching),
              ...getEnablePhoneticMatchingParameters(enablePhoneticMatching),
            },
            hitContext,
            undefined,
            'TRANSACTION'
          )
          return {
            sanctionsDetails: {
              name: paymentDetail.name,
              searchId: result.searchId,
              entityType: paymentDetail.entityType,
              hitContext,
            },
            hitsCount: result.hitsCount,
          }
        }
      ),
      ...bankInfos.map(
        async (bankInfo): Promise<SanctionsRuleResult | undefined> => {
          const paymentMethodId = getPaymentMethodId(paymentDetails)
          const hitContext: SanctionsHitContext = {
            entity: 'BANK' as const,
            ruleInstanceId: this.ruleInstance.id ?? '',
            transactionId: this.transaction.transactionId,
            userId: user?.userId ?? paymentMethodId,
            searchTerm: bankInfo.bankName,
            entityType: 'BANK_NAME',
          }
          if (!bankInfo.bankName) {
            return
          }
          const result = await this.sanctionsService.search(
            {
              searchTerm: bankInfo.bankName,
              types: this.parameters.screeningTypes || [],
              fuzziness: fuzziness / 100,
              monitoring: {
                enabled: false,
              },
              ...getFuzzinessSettings(fuzzinessSetting),
              ...getEntityTypeForSearch('BANK'),
              ...getStopwordSettings(stopwords),
              ...getIsActiveParameters(screeningTypes, isActive),
              ...getPartialMatchParameters(partialMatch),
              ...getFuzzyAddressMatchingParameters(
                providers,
                fuzzyAddressMatching,
                bankInfo.address ? [bankInfo.address] : undefined
              ),
            },
            hitContext,
            undefined,
            'TRANSACTION'
          )
          return {
            sanctionsDetails: {
              name: bankInfo.bankName,
              searchId: result.searchId,
              entityType: 'BANK_NAME',
              hitContext,
            },
            hitsCount: result.hitsCount,
          }
        }
      ),
    ])

    const filteredData = (data ?? []).filter(notNullish)
    return {
      ruleHitSanctionsDetails: filteredData
        .filter((detail) => detail.hitsCount > 0)
        .map((detail) => detail.sanctionsDetails),
      ruleExecutionSanctionsDetails: filteredData.map((detail) => ({
        ...detail.sanctionsDetails,
        isRuleHit: detail.hitsCount > 0,
      })),
    }
  }
}
