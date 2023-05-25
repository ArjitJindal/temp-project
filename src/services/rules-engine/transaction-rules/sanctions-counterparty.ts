import _ from 'lodash'
import { JSONSchemaType } from 'ajv'
import {
  FUZZINESS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { BankInfo, IBANService } from '@/services/iban.com'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { SanctionsService } from '@/services/sanctions'
import { formatConsumerName } from '@/utils/helpers'

export type SanctionsCounterPartyRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
  screeningTypes?: SanctionsSearchType[]
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
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        resolveIban: {
          type: 'boolean',
          title: 'Resolve IBAN number',
          description:
            'Enable if you want to identify Bank name using IBAN numbers.',
          nullable: true,
        },
      },
      required: ['fuzziness'],
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
      const senderUserHitRulesResult = await this.checkCounterPartyTranasction(
        this.transaction.originPaymentDetails,
        'ORIGIN'
      )

      hitRules.push(...senderUserHitRulesResult)
    }

    if (!this.receiverUser && this.transaction.destinationPaymentDetails) {
      const receiverUserHitRulesResult =
        await this.checkCounterPartyTranasction(
          this.transaction.destinationPaymentDetails,
          'DESTINATION'
        )

      hitRules.push(...receiverUserHitRulesResult)
    }

    return hitRules
  }

  private async checkCounterPartyTranasction(
    paymentDetails: PaymentDetails,
    type: 'ORIGIN' | 'DESTINATION'
  ): Promise<RuleHitResult> {
    const namesToSearch: Array<string | undefined> = []

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
      namesToSearch.push(bankInfo?.bankName)
    }

    switch (paymentDetails.method) {
      case 'CARD':
        namesToSearch.push(formatConsumerName(paymentDetails.nameOnCard))
        break
      case 'GENERIC_BANK_ACCOUNT':
      case 'IBAN':
      case 'SWIFT':
      case 'UPI':
      case 'WALLET':
      case 'CHECK':
        namesToSearch.push(paymentDetails.name)
        break
      case 'ACH':
        namesToSearch.push(paymentDetails.name, paymentDetails.beneficiaryName)
        break
    }

    const namesToSearchFiltered = _.uniq(namesToSearch).filter(
      Boolean
    ) as string[]
    const sanctionsService = new SanctionsService(this.tenantId)
    const fuzziness = this.parameters.fuzziness

    const data = await Promise.all(
      namesToSearchFiltered.map(async (name) => {
        const result = await sanctionsService.search({
          searchTerm: name,
          types: this.parameters.screeningTypes || [],
          fuzziness: fuzziness / 100,
          monitoring: {
            enabled: false,
          },
        })

        if (result.data.length > 0) {
          return { name, searchId: result.searchId } as SanctionsDetails
        }
      })
    )

    const hitResult: RuleHitResult = []

    const filteredData = data?.filter(Boolean) as SanctionsDetails[]

    if (filteredData?.length > 0) {
      hitResult.push({
        direction: type,
        vars: super.getTransactionVars(
          type === 'ORIGIN' ? 'origin' : 'destination'
        ),
        sanctionsDetails: _.uniqBy(
          filteredData as SanctionsDetails[],
          (detail) => detail.name
        ),
      })
    }

    return hitResult
  }
}
