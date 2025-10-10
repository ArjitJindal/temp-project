import { removePrefixFromName } from '../utils/transaction-rule-utils'
import PaymentDetailChangeRuleBase from './payment-detail-change-base'
import {
  AcceptedPaymentDetails,
  isTransactionMethodValid,
} from './using-too-many-banks-to-make-payments'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export class BankAccountHolderNameChangeRule extends PaymentDetailChangeRuleBase {
  getPaymentDetail(paymentDetails?: PaymentDetails): string | undefined {
    if (isTransactionMethodValid(paymentDetails?.method)) {
      const accountholderName = (paymentDetails as AcceptedPaymentDetails)?.name
      return removePrefixFromName(accountholderName ?? '', true)
    }
  }
}
