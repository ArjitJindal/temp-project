import _ from 'lodash'
import { JSONSchemaType } from 'ajv'
import {
  FUZZINESS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { BankInfo, IBANService } from '@/services/iban.com'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { SanctionsService } from '@/services/sanctions'
import { formatConsumerName } from '@/utils/helpers'
import { notNullish } from '@/core/utils/array'

export type SanctionsCounterPartyRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes: SanctionsSearchType[]
  fuzziness: number
  resolveIban?: boolean
}

export class SanctionsCounterPartyRule extends TransactionRule<SanctionsCounterPartyRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsCounterPartyRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA({}),
        screeningTypes: SANCTIONS_SCREENING_TYPES_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        resolveIban: {
          type: 'boolean',
          title: 'Resolve IBAN number',
          description:
            'Enable if you want to identify Bank name using IBAN numbers.',
          nullable: true,
        },
      },
      required: ['fuzziness', 'screeningTypes'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const hitRules: RuleHitResult = []

    if (
      (this.senderUser && this.receiverUser) ||
      _.isEmpty(this.parameters?.screeningTypes)
    ) {
      return hitRules
    }

    const isThresholdHit = this.parameters?.transactionAmountThreshold
      ? await checkTransactionAmountBetweenThreshold(
          this.transaction.originAmountDetails,
          _.mapValues(
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
          sanctionsDetails: _.uniqBy(sanctionsDeatils, (detail) => detail.name),
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
          sanctionsDetails: _.uniqBy(sanctionsDeatils, (detail) => detail.name),
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

    const ibanService = new IBANService(this.tenantId)

    if (this.parameters.resolveIban && bankInfo) {
      bankInfo = (await ibanService.resolveBankName([bankInfo]))[0]
      if (bankInfo?.bankName != null) {
        namesToSearch.push({ name: bankInfo.bankName, entityType: 'BANK_NAME' })
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
    }

    const namesToSearchFiltered = []
    for (const item of namesToSearch) {
      if (namesToSearchFiltered.find((x) => x.name === item.name) == null) {
        namesToSearchFiltered.push(item)
      }
    }
    const sanctionsService = new SanctionsService(this.tenantId)
    const fuzziness = this.parameters.fuzziness

    const data = await Promise.all(
      namesToSearchFiltered.map(
        async ({ name, entityType }): Promise<SanctionsDetails | undefined> => {
          const result = await sanctionsService.search({
            searchTerm: name,
            types: this.parameters.screeningTypes || [],
            fuzziness: fuzziness / 100,
            monitoring: {
              enabled: false,
            },
          })

          if (result.data.length > 0) {
            return { name, searchId: result.searchId, entityType }
          }
        }
      )
    )

    const filteredData: SanctionsDetails[] = (data ?? []).filter(notNullish)
    return filteredData
  }
}
