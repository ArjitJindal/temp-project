import { JSONSchemaType } from 'ajv'
import { TransactionRuleFilter } from './filter'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type TransactionWalletTypeRuleFilterParameter = {
  walletType?: string
}

function transactionWalletTypeRuleFilterPredicate(
  paymentDetails: PaymentDetails | undefined,
  walletType: string | undefined
) {
  if (!walletType) {
    return true
  }

  if (paymentDetails?.method === 'WALLET') {
    return paymentDetails.walletType === walletType
  }

  return false
}

export class TransactionWalletTypeRuleFilter extends TransactionRuleFilter<TransactionWalletTypeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionWalletTypeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        walletType: {
          type: 'string',
          title: 'Wallet Type',
          description:
            'Add wallet type to only run this rule for certain wallet types',
          nullable: true,
          'ui:schema': {
            'ui:group': 'transaction',
          },
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    const { walletType } = this.parameters

    const isOriginWalletTypeMatch = transactionWalletTypeRuleFilterPredicate(
      this.transaction.originPaymentDetails,
      walletType
    )

    const isDestinationWalletTypeMatch =
      transactionWalletTypeRuleFilterPredicate(
        this.transaction.destinationPaymentDetails,
        walletType
      )

    return Boolean(isOriginWalletTypeMatch || isDestinationWalletTypeMatch)
  }
}

/**
 * Filter Behaviour:
 * 1. If walletType filter is not set, then the rule will always run
 * 2. If walletType filter is set, then the rule will only run if the transaction method is wallet and the wallet type matches the filter in either origin or destination
 * 3. If walletType filter is set, then the rule will not run if the transaction method is not wallet in either origin or destination atleast one of origin or destination wallet type matches the filter
 * 4. If payment details is not set in either origin or destination, then the rule will not run
 * 5. If origin payment details is set but destination payment details is not set and origin wallet type does not match the filter, then the rule will not run
 */
