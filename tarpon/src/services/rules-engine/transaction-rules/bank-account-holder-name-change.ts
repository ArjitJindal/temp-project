import PaymentDetailChangeRuleBase from './payment-detail-change-base'
import {
  AcceptedPaymentDetails,
  isTransactionMethodValid,
} from './using-too-many-banks-to-make-payments'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export class BankAccountHolderNameChangeRule extends PaymentDetailChangeRuleBase {
  getPaymentDetail(paymentDetails?: PaymentDetails): string | undefined {
    if (isTransactionMethodValid(paymentDetails?.method)) {
      return (paymentDetails as AcceptedPaymentDetails)?.name
    }
  }
}
