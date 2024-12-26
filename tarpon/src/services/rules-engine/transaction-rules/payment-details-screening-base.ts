import { JSONSchemaType } from 'ajv'
import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  RESOLVE_IBAN_NUMBER_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { BankInfo } from '@/services/iban'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { formatConsumerName } from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { notNullish } from '@/utils/array'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'

export type PaymentDetailsScreeningRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  resolveIban?: boolean
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
        resolveIban: RESOLVE_IBAN_NUMBER_SCHEMA({
          uiSchema: {
            requiredFeatures: ['IBAN_RESOLUTION'],
          },
        }),
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
      iban?: string
      entityType: SanctionsDetailsEntityType
    }> = []

    let bankInfo: BankInfo | undefined = undefined

    if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
      bankInfo = {
        bankName: paymentDetails.bankName,
        iban: paymentDetails.accountNumber,
      }
    }

    if (paymentDetails.method === 'IBAN') {
      bankInfo = {
        bankName: paymentDetails.bankName,
        iban: paymentDetails.IBAN,
      }
    }

    if (this.parameters.resolveIban && bankInfo) {
      bankInfo = (await this.ibanService.resolveBankNames([bankInfo]))[0]
      if (bankInfo?.bankName != null) {
        namesToSearch.push({
          name: bankInfo.bankName,
          iban: bankInfo.iban,
          entityType: 'BANK_NAME',
        })
      }
    }

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
        async ({
          name,
          iban,
          entityType,
        }): Promise<SanctionsDetails | undefined> => {
          const paymentDetailIdentifierField = paymentDetails.method
            ? PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails.method][0]
            : undefined
          const hitContext = {
            entity: 'EXTERNAL_USER' as const,
            ruleInstanceId: this.ruleInstance.id ?? '',
            transactionId: this.transaction.transactionId,
            userId:
              user?.userId ??
              (paymentDetailIdentifierField
                ? paymentDetails[paymentDetailIdentifierField]
                : undefined),
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
            },
            hitContext
          )

          if (result.hitsCount > 0) {
            return {
              name,
              iban,
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
