import { JSONSchemaType } from 'ajv'
import { TransactionRule } from '@/services/rules-engine/transaction-rules/rule'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { RuleHitResult } from '@/services/rules-engine/rule'
import { ListSubtype } from '@/@types/openapi-internal/ListSubtype'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'
import { neverReturn } from '@/utils/lang'

export type BlacklistTransactionMatchedFieldRuleParameters = {
  blacklistId: string
}

type TransactionField = {
  direction: 'ORIGIN' | 'DESTINATION'
  label: string
  value?: string
}

@traceable
export default class BlacklistTransactionMatchedFieldRule extends TransactionRule<BlacklistTransactionMatchedFieldRuleParameters> {
  public static getSchema(): JSONSchemaType<BlacklistTransactionMatchedFieldRuleParameters> {
    return {
      type: 'object',
      properties: {
        blacklistId: {
          type: 'string',
          title: 'Blacklist ID',
        },
      },
      required: ['blacklistId'],
    }
  }

  public async computeRule() {
    const listRepo = new ListRepository(this.tenantId, this.dynamoDb)
    const listHeader = await listRepo.getListHeader(this.parameters.blacklistId)
    const hitResult: RuleHitResult = []

    if (
      listHeader == null ||
      listHeader?.listType !== 'BLACKLIST' ||
      !listHeader?.metadata?.status
    ) {
      return {
        ruleHitResult: hitResult,
      }
    }

    const transactionFieldsToMatch =
      this.getTransactionFieldByListSubtype(
        this.transaction,
        listHeader.subtype
      )?.filter((field) => field.value) ?? []

    for (const field of transactionFieldsToMatch) {
      const match = await listRepo.match(
        listHeader,
        field.value as string,
        'EXACT'
      )

      if (match) {
        hitResult.push({
          direction: field.direction,
          vars: {
            value: field.value,
            blackListId: this.parameters.blacklistId,
            variableType: field.label,
          },
        })
      }
    }

    return {
      ruleHitResult: hitResult,
    }
  }

  private getTransactionFieldByListSubtype(
    transaction: Transaction,
    listSubtype: ListSubtype
  ): TransactionField[] | undefined {
    switch (listSubtype) {
      case 'USER_ID':
        return [
          {
            label: 'User ID',
            value: transaction?.originUserId,
            direction: 'ORIGIN',
          },
          {
            label: 'User ID',
            value: transaction?.destinationUserId,
            direction: 'DESTINATION',
          },
        ]

      case 'CARD_FINGERPRINT_NUMBER': {
        const fields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'CARD') {
          fields.push({
            label: 'Card Fingerprint Number',
            value: transaction?.originPaymentDetails?.cardFingerprint,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'CARD') {
          fields.push({
            label: 'Card Fingerprint Number',
            value: transaction?.destinationPaymentDetails?.cardFingerprint,
            direction: 'DESTINATION',
          })
        }

        return fields
      }

      case 'IBAN_NUMBER': {
        const ibanFields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'IBAN') {
          ibanFields.push({
            label: 'IBAN Number',
            value: transaction?.originPaymentDetails?.IBAN,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'IBAN') {
          ibanFields.push({
            label: 'IBAN Number',
            value: transaction?.destinationPaymentDetails?.IBAN,
            direction: 'DESTINATION',
          })
        }

        return ibanFields
      }

      case 'ACH_ACCOUNT_NUMBER': {
        const achFields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'ACH') {
          achFields.push({
            label: 'ACH Account Number',
            value: transaction?.originPaymentDetails?.accountNumber,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'ACH') {
          achFields.push({
            label: 'ACH Account Number',
            value: transaction?.destinationPaymentDetails?.accountNumber,
            direction: 'DESTINATION',
          })
        }

        return achFields
      }

      case 'SWIFT_ACCOUNT_NUMBER': {
        const swiftFields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'SWIFT') {
          swiftFields.push({
            label: 'SWIFT Account Number',
            value: transaction?.originPaymentDetails?.accountNumber,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'SWIFT') {
          swiftFields.push({
            label: 'SWIFT Account Number',
            value: transaction?.destinationPaymentDetails?.accountNumber,
            direction: 'DESTINATION',
          })
        }

        return swiftFields
      }

      case 'BIC': {
        const bicFields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'IBAN') {
          bicFields.push({
            label: 'BIC',
            value: transaction?.originPaymentDetails?.BIC,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'IBAN') {
          bicFields.push({
            label: 'BIC',
            value: transaction?.destinationPaymentDetails?.BIC,
            direction: 'DESTINATION',
          })
        }

        return bicFields
      }

      case 'BANK_SWIFT_CODE': {
        const swiftCodeFields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'SWIFT') {
          swiftCodeFields.push({
            label: 'Bank Swift Code',
            value: transaction?.originPaymentDetails?.swiftCode,
            direction: 'ORIGIN',
          })
        }

        if (transaction?.destinationPaymentDetails?.method === 'SWIFT') {
          swiftCodeFields.push({
            label: 'Bank Swift Code',
            value: transaction?.destinationPaymentDetails?.swiftCode,
            direction: 'DESTINATION',
          })
        }

        return swiftCodeFields
      }

      case 'BANK_ACCOUNT_NUMBER': {
        const bankAccountFields: TransactionField[] = []

        if (
          transaction?.originPaymentDetails?.method === 'GENERIC_BANK_ACCOUNT'
        ) {
          bankAccountFields.push({
            label: 'Bank Account Number',
            value: transaction?.originPaymentDetails?.accountNumber,
            direction: 'ORIGIN',
          })
        }

        if (
          transaction?.destinationPaymentDetails?.method ===
          'GENERIC_BANK_ACCOUNT'
        ) {
          bankAccountFields.push({
            label: 'Bank Account Number',
            value: transaction?.destinationPaymentDetails?.accountNumber,
            direction: 'DESTINATION',
          })
        }

        return bankAccountFields
      }

      case 'UPI_IDENTIFYING_NUMBER': {
        const fields: TransactionField[] = []

        if (transaction?.originPaymentDetails?.method === 'UPI') {
          fields.push({
            label: 'UPI Identifier Number',
            value: transaction?.originPaymentDetails?.upiID,
            direction: 'ORIGIN',
          })
        }
        if (transaction?.destinationPaymentDetails?.method === 'UPI') {
          fields.push({
            label: 'UPI Identifier Number',
            value: transaction?.destinationPaymentDetails?.upiID,
            direction: 'DESTINATION',
          })
        }
        return fields
      }
      case 'COUNTRY': {
        const fields: TransactionField[] = []
        for (const [direction, paymentDetails] of [
          ['ORIGIN', transaction.originPaymentDetails],
          ['DESTINATION', transaction.destinationPaymentDetails],
        ] as const) {
          if (paymentDetails?.method === 'CARD') {
            fields.push({
              label: 'Country',
              value: paymentDetails.cardIssuedCountry,
              direction: direction,
            })
          }
          if (
            paymentDetails?.method === 'ACH' ||
            paymentDetails?.method === 'SWIFT'
          ) {
            fields.push({
              label: 'Country',
              value: paymentDetails.bankAddress?.country,
              direction: direction,
            })
          }
          if (paymentDetails?.method === 'CHECK') {
            fields.push({
              label: 'Country',
              value: paymentDetails.shippingAddress?.country,
              direction: direction,
            })
          }
          if (
            paymentDetails?.method === 'GENERIC_BANK_ACCOUNT' ||
            paymentDetails?.method === 'IBAN'
          ) {
            fields.push({
              label: 'Country',
              value: paymentDetails.country,
              direction: direction,
            })
          }
        }
        return fields
      }

      case 'IP_ADDRESS':
      case 'DEVICE_IDENTIFIER':
      case 'STRING':
      case 'CUSTOM':
        return []

      default:
        return neverReturn(listSubtype, [])
    }
  }
}
