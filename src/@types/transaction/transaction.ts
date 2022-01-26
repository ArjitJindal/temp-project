import { DeviceData } from './deviceData'
import { PaymentAmountDetails } from './paymentAmountDetails'
import { PaymentDetails } from './paymentDetails'

export type Transaction = {
  transactionId?: string
  userId: string
  sendingAmountDetails: PaymentAmountDetails
  receivingAmountDetails: PaymentAmountDetails
  timestamp: number
  promotionCodeUsed?: boolean
  productType: string
  senderPaymentDetails: PaymentDetails
  receiverPaymentDetails: PaymentDetails
  reference?: string
  deviceData?: DeviceData
  tags?: { [key: string]: string }
}
