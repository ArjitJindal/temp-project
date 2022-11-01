import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { TransactionRule } from './rule'
import { CardExpiry } from '@/@types/openapi-public/CardExpiry'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

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
          title: 'Blacklist Card Payment Details',
          items: {
            type: 'object',
            properties: {
              cardFingerprint: {
                type: 'string',
                title: 'Card Fingerprint',
                nullable: true,
              },
              cardLast4Digits: {
                type: 'string',
                title: 'Card Last 4 Digits',
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
                title: 'Card Expiry Date',
                nullable: true,
              },
              nameOnCard: {
                type: 'string',
                title: 'Card Holder Name',
                nullable: true,
              },
            },
          },
          nullable: true,
        },

        blacklistedGenericBankAccountPaymentDetails: {
          type: 'array',
          title: 'Blacklist Bank Account Numbers',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: [],
    }
  }

  public async computeRule() {
    if (
      this.transaction.originPaymentDetails &&
      this.isPaymentBlacklisted(this.transaction.originPaymentDetails)
    ) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
    if (
      this.transaction.destinationPaymentDetails &&
      this.isPaymentBlacklisted(this.transaction.destinationPaymentDetails)
    ) {
      return {
        action: this.action,
        vars: super.getTransactionVars('destination'),
      }
    }
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
                _.isEqual(
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
