import { JSONSchemaType } from 'ajv'
import { compact, uniqBy } from 'lodash'
import {
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
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import {
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getScreeningValues,
  getStopwordSettings,
} from '../utils/rule-utils'
import { GenericScreeningValues } from '../user-rules/generic-sanctions-consumer-user'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import {
  extractBankInfoFromPaymentDetails,
  getPaymentDetailsName,
} from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { notNullish } from '@/utils/array'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionsDataProviders } from '@/services/sanctions/types'

export type ScreeningField = 'NAME' | 'BANK_NAME'
export const SCREENING_FIELDS: ScreeningField[] = ['NAME', 'BANK_NAME']

export type PaymentDetailsScreeningRuleParameters = {
  screeningFields: ScreeningField[]
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  screeningValues?: GenericScreeningValues[]
  fuzzyAddressMatching?: boolean
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

  abstract computeRule(): Promise<RuleHitResult>

  public async checkCounterPartyTransaction(
    paymentDetails: PaymentDetails,
    user?: User | Business
  ): Promise<SanctionsDetails[]> {
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
    } = this.parameters
    const namesToSearch = screeningFields.includes('NAME')
      ? getPaymentDetailsName(paymentDetails)
      : []

    const bankInfos = screeningFields.includes('BANK_NAME')
      ? compact([extractBankInfoFromPaymentDetails(paymentDetails)])
      : []
    const namesToSearchFiltered = uniqBy(namesToSearch, (item) => item.name)
    const providers = getDefaultProviders()
    const data = await Promise.all([
      ...namesToSearchFiltered.map(
        async (paymentDetail): Promise<SanctionsDetails | undefined> => {
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
              ...getFuzzinessSettings(providers, fuzzinessSetting),
              ...getEntityTypeForSearch(providers, 'EXTERNAL_USER'),
              ...getStopwordSettings(providers, stopwords),
              ...getIsActiveParameters(providers, screeningTypes, isActive),
              ...getPartialMatchParameters(providers, partialMatch),
              ...getScreeningValues(providers, screeningValues, paymentDetail),
              ...getFuzzyAddressMatchingParameters(
                providers,
                fuzzyAddressMatching,
                paymentDetail.address ? [paymentDetail.address] : undefined
              ),
            },
            hitContext,
            undefined,
            'TRANSACTION'
          )

          if (result.hitsCount > 0) {
            return {
              name: paymentDetail.name,
              searchId: result.searchId,
              entityType: paymentDetail.entityType,
              hitContext,
            }
          }
        }
      ),
      ...bankInfos.map(
        async (bankInfo): Promise<SanctionsDetails | undefined> => {
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
              ...getFuzzinessSettings(providers, fuzzinessSetting),
              ...getEntityTypeForSearch(providers, 'BANK'),
              ...getStopwordSettings(providers, stopwords),
              ...getIsActiveParameters(providers, screeningTypes, isActive),
              ...getPartialMatchParameters(providers, partialMatch),
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

          if (result.hitsCount > 0) {
            return {
              name: bankInfo.bankName,
              searchId: result.searchId,
              entityType: 'BANK_NAME',
              hitContext,
            }
          }
        }
      ),
    ])

    const filteredData: SanctionsDetails[] = (data ?? []).filter(notNullish)
    return filteredData
  }
}
