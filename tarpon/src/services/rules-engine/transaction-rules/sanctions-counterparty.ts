import { JSONSchemaType } from 'ajv'
import { isEmpty, mapValues, uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  RESOLVE_IBAN_NUMBER_SCHEMA,
  SANCTIONS_SCREENING_TYPES_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { BankInfo } from '@/services/iban'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { formatConsumerName } from '@/utils/helpers'
import { notNullish } from '@/core/utils/array'
import { traceable } from '@/core/xray'

export type SanctionsCounterPartyRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes: SanctionsSearchType[]
  fuzziness: number
  resolveIban?: boolean
}

@traceable
export class SanctionsCounterPartyRule extends TransactionRule<SanctionsCounterPartyRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsCounterPartyRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA({}),
        screeningTypes: SANCTIONS_SCREENING_TYPES_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        resolveIban: RESOLVE_IBAN_NUMBER_SCHEMA({
          uiSchema: {
            requiredFeatures: ['IBAN_RESOLUTION'],
          },
        }),
      },
      required: ['fuzziness', 'screeningTypes'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const hitRules: RuleHitResult = []

    if (
      (this.senderUser && this.receiverUser) ||
      isEmpty(this.parameters?.screeningTypes)
    ) {
      return hitRules
    }

    const isThresholdHit = this.parameters?.transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          mapValues(
            this.parameters.transactionAmountThreshold,
            (threshold) => ({
              min: threshold,
            })
          )
        )
      : true

    if (!isThresholdHit) {
      return hitRules
    }

    if (!this.senderUser && this.transaction.originPaymentDetails) {
      const sanctionsDeatils = await this.checkCounterPartyTranasction(
        this.transaction.originPaymentDetails
      )
      if (sanctionsDeatils.length > 0) {
        hitRules.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
          sanctionsDetails: uniqBy(sanctionsDeatils, (detail) => detail.name),
        })
      }
    }

    if (!this.receiverUser && this.transaction.destinationPaymentDetails) {
      const sanctionsDeatils = await this.checkCounterPartyTranasction(
        this.transaction.destinationPaymentDetails
      )
      if (sanctionsDeatils.length > 0) {
        hitRules.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
          sanctionsDetails: uniqBy(sanctionsDeatils, (detail) => detail.name),
        })
      }
    }

    return hitRules
  }

  private async checkCounterPartyTranasction(
    paymentDetails: PaymentDetails
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
          const result = await this.sanctionsService.search(
            {
              searchTerm: name,
              types: this.parameters.screeningTypes || [],
              fuzziness: fuzziness / 100,
              monitoring: {
                enabled: false,
              },
            },
            {
              entity: 'EXTERNAL_USER',
              ruleInstanceId: this.ruleInstance.id ?? '',
              transactionId: this.transaction.transactionId,
            }
          )

          if (result.data.length > 0) {
            return {
              name,
              iban,
              searchId: result.searchId,
              entityType,
            }
          }
        }
      )
    )

    const filteredData: SanctionsDetails[] = (data ?? []).filter(notNullish)
    return filteredData
  }
}
