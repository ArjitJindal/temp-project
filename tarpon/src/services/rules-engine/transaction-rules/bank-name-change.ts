import PaymentDetailChangeRuleBase from './payment-detail-change-base'
import { getBankname } from '@/core/dynamodb/dynamodb-keys'
import { traceable } from '@/core/xray'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

@traceable
export default class BankNameChangeRule extends PaymentDetailChangeRuleBase {
  getPaymentDetail(paymentDetails?: PaymentDetails): string | undefined {
    return getBankname(paymentDetails)?.toLowerCase()
  }
}
