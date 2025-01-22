import { JSONSchemaType } from 'ajv'
import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { getEntityTypeForSearch } from '../utils/rule-utils'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { formatConsumerName } from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { notNullish } from '@/utils/array'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { getDefaultProvider } from '@/services/sanctions/utils'

export type PaymentDetailsScreeningRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
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
      },
      required: ['fuzziness'],
      additionalProperties: false,
    }
  }

  abstract computeRule(): Promise<RuleHitResult>

  public async checkCounterPartyTransaction(
    paymentDetails: PaymentDetails,
    user?: User | Business
  ): Promise<SanctionsDetails[]> {
    const namesToSearch: Array<{
      name: string
      entityType: SanctionsDetailsEntityType
    }> = []
    const provider = getDefaultProvider()
    switch (paymentDetails.method) {
      case 'CARD':
        {
          const formattedName = formatConsumerName(paymentDetails.nameOnCard)
          if (formattedName != null) {
            namesToSearch.push({
              name: formattedName,
              entityType: 'NAME_ON_CARD',
            })
          }
        }
        break
      case 'GENERIC_BANK_ACCOUNT':
      case 'IBAN':
      case 'SWIFT':
      case 'UPI':
      case 'WALLET':
      case 'CHECK':
        if (paymentDetails.name != null) {
          namesToSearch.push({
            name: paymentDetails.name,
            entityType: 'PAYMENT_NAME',
          })
        }
        break
      case 'ACH':
        if (paymentDetails.name != null) {
          namesToSearch.push({
            name: paymentDetails.name,
            entityType: 'PAYMENT_NAME',
          })
        }
        if (paymentDetails.beneficiaryName != null) {
          namesToSearch.push({
            name: paymentDetails.beneficiaryName,
            entityType: 'PAYMENT_BENEFICIARY_NAME',
          })
        }
        break
      case 'MPESA':
      case 'CASH':
        break
    }

    const namesToSearchFiltered = uniqBy(namesToSearch, (item) => item.name)
    const fuzziness = this.parameters.fuzziness

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
              ...getEntityTypeForSearch(provider, 'PERSON'),
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
