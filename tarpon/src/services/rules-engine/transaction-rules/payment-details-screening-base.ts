import { JSONSchemaType } from 'ajv'
import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { getFuzzinessSettings } from '../utils/rule-utils'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { getPaymentDetailsName } from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { notNullish } from '@/utils/array'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { getDefaultProvider } from '@/services/sanctions/utils'

export type PaymentDetailsScreeningRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
}

@traceable
export abstract class PaymentDetailsScreeningRuleBase extends TransactionRule<PaymentDetailsScreeningRuleParameters> {
  public static getSchema(): JSONSchemaType<PaymentDetailsScreeningRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA({}),
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
      },
      required: ['fuzziness', 'fuzzinessSetting'],
      additionalProperties: false,
    }
  }

  abstract computeRule(): Promise<RuleHitResult>

  public async checkCounterPartyTransaction(
    paymentDetails: PaymentDetails,
    user?: User | Business
  ): Promise<SanctionsDetails[]> {
    const namesToSearch = getPaymentDetailsName(paymentDetails)

    const namesToSearchFiltered = uniqBy(namesToSearch, (item) => item.name)
    const fuzziness = this.parameters.fuzziness
    const fuzzinessSetting = this.parameters.fuzzinessSetting
    const provider = getDefaultProvider()
    const data = await Promise.all(
      namesToSearchFiltered.map(
        async ({ name, entityType }): Promise<SanctionsDetails | undefined> => {
          const paymentMethodId = getPaymentMethodId(paymentDetails)
          const hitContext = {
            entity: 'EXTERNAL_USER' as const,
            ruleInstanceId: this.ruleInstance.id ?? '',
            transactionId: this.transaction.transactionId,
            userId: user?.userId ?? paymentMethodId,
            searchTerm: name,
            entityType,
          }
          const result = await this.sanctionsService.search(
            {
              searchTerm: name,
              types: this.parameters.screeningTypes || [],
              fuzziness: fuzziness / 100,
              monitoring: {
                enabled: false,
              },
              ...getFuzzinessSettings(provider, fuzzinessSetting),
            },
            hitContext
          )

          if (result.hitsCount > 0) {
            return {
              name,
              searchId: result.searchId,
              entityType,
              hitContext,
            }
          }
        }
      )
    )

    const filteredData: SanctionsDetails[] = (data ?? []).filter(notNullish)
    return filteredData
  }
}
