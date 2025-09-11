import { JSONSchemaType } from 'ajv'

import isEqual from 'lodash/isEqual'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { CardExpiry } from '@/@types/openapi-public/CardExpiry'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { traceable } from '@/core/xray'

export type BlacklistPaymentdetailsRuleParameters = {
  blacklistedIBANPaymentDetails?: string[]
  blacklistedCardPaymentDetails?: {
    cardFingerprint?: string
    cardLast4Digits?: string
    cardExpiry?: CardExpiry
    nameOnCard?: string
  }[]
  blacklistedGenericBankAccountPaymentDetails?: string[]
}

@traceable
export default class BlacklistPaymentdetailsRule extends TransactionRule<BlacklistPaymentdetailsRuleParameters> {
  public static getSchema(): JSONSchemaType<BlacklistPaymentdetailsRuleParameters> {
    return {
      type: 'object',
      properties: {
        blacklistedIBANPaymentDetails: {
          type: 'array',
          title: 'Blacklist IBANs',
          items: { type: 'string' },
          nullable: true,
        },
        blacklistedCardPaymentDetails: {
          type: 'array',
          title: 'Blacklist card payment details',
          items: {
            type: 'object',
            properties: {
              cardFingerprint: {
                type: 'string',
                title: 'Card fingerprint',
                nullable: true,
              },
              cardLast4Digits: {
                type: 'string',
                title: 'Card last 4 digits',
                nullable: true,
              },
              cardExpiry: {
                type: 'object',
                properties: {
                  month: {
                    type: 'integer',
                    title: 'Month',
                    nullable: true,
                  },
                  year: {
                    type: 'integer',
                    title: 'Year',
                    nullable: true,
                  },
                },
                title: 'Card expiry date',
                nullable: true,
              },
              nameOnCard: {
                type: 'string',
                title: 'Card holder name',
                nullable: true,
              },
            },
          },
          nullable: true,
        },

        blacklistedGenericBankAccountPaymentDetails: {
          type: 'array',
          title: 'Blacklist bank account numbers',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: [],
    }
  }

  public async computeRule() {
    const hitResult: RuleHitResult = []
    const senderHit =
      this.transaction.originPaymentDetails &&
      this.isPaymentBlacklisted(this.transaction.originPaymentDetails)
    const receiverHit =
      this.transaction.destinationPaymentDetails &&
      this.isPaymentBlacklisted(this.transaction.destinationPaymentDetails)
    if (senderHit || receiverHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: senderHit ? super.getTransactionVars('origin') : undefined,
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: receiverHit ? super.getTransactionVars('destination') : undefined,
      })
    }
    return hitResult
  }

  private isPaymentBlacklisted(paymentDetails: PaymentDetails) {
    const method = paymentDetails.method
    const {
      blacklistedIBANPaymentDetails,
      blacklistedGenericBankAccountPaymentDetails,
      blacklistedCardPaymentDetails,
    } = this.parameters
    if (method === 'IBAN') {
      return (
        paymentDetails.IBAN &&
        blacklistedIBANPaymentDetails?.includes(paymentDetails.IBAN)
      )
    }
    if (method === 'GENERIC_BANK_ACCOUNT') {
      return (
        paymentDetails.accountNumber &&
        blacklistedGenericBankAccountPaymentDetails?.includes(
          paymentDetails.accountNumber
        )
      )
    }
    if (method === 'CARD') {
      const name = `${paymentDetails.nameOnCard?.firstName} ${paymentDetails.nameOnCard?.middleName} ${paymentDetails.nameOnCard?.lastName}`
      return (
        blacklistedCardPaymentDetails &&
        Boolean(
          blacklistedCardPaymentDetails.find((cardPaymentDetail) => {
            return (
              cardPaymentDetail.cardFingerprint ===
                paymentDetails.cardFingerprint ||
              (cardPaymentDetail.cardLast4Digits ===
                paymentDetails.cardLast4Digits &&
                isEqual(
                  cardPaymentDetail.cardExpiry,
                  paymentDetails.cardExpiry
                ) &&
                cardPaymentDetail.nameOnCard === name)
            )
          })
        )
      )
    }
    return false
  }
}
