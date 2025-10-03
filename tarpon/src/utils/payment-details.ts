import { formatConsumerName, getAddressStringForAggregation } from './helpers'
import { neverReturn } from './lang'
import { Address } from '@/@types/openapi-public/Address'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export const getPaymentDetailsName = (
  paymentDetails: PaymentDetails | undefined
): string | undefined => {
  if (!paymentDetails) {
    return
  }

  switch (paymentDetails.method) {
    case 'GENERIC_BANK_ACCOUNT':
    case 'IBAN':
    case 'ACH':
    case 'SWIFT':
    case 'UPI':
    case 'WALLET':
    case 'CHECK':
    case 'CASH':
    case 'MPESA':
      return paymentDetails.name
    case 'CARD':
      return formatConsumerName(paymentDetails.nameOnCard)
    case 'NPP':
      return formatConsumerName(paymentDetails.name)
  }

  return neverReturn(paymentDetails, undefined)
}

export function getPaymentMethodId(
  pm: PaymentDetails | undefined
): string | undefined {
  if (!pm) {
    return
  }
  switch (pm.method) {
    case 'ACH':
      return pm.accountNumber
    case 'CARD':
      return pm.cardFingerprint
    case 'GENERIC_BANK_ACCOUNT':
      return pm.accountNumber
    case 'WALLET':
      return pm.walletId
    case 'CHECK':
      return pm.checkIdentifier
    case 'IBAN':
      return pm.IBAN
    case 'MPESA':
      return pm.phoneNumber
    case 'SWIFT':
      return pm.accountNumber
    case 'UPI':
      return pm.upiID
    case 'CASH':
      return pm.identifier
    case 'NPP':
      return pm.payId
  }
}

export const getPaymentMethodAddress = (
  pm: PaymentDetails | undefined
): Address | undefined => {
  if (!pm) {
    return
  }

  switch (pm.method) {
    case 'CHECK':
      return pm.shippingAddress
    case 'CASH':
    case 'NPP':
    case 'GENERIC_BANK_ACCOUNT':
    case 'MPESA':
    case 'CARD':
    case 'SWIFT':
    case 'WALLET':
      return pm.address
    case 'IBAN':
    case 'ACH':
      return pm.bankAddress
    case 'UPI':
      return pm.address
  }
}

export const getPaymentMethodAddressString = (
  pm: PaymentDetails | undefined
): string | undefined => {
  if (!pm) {
    return
  }
  switch (pm.method) {
    case 'CHECK':
      return getAddressStringForAggregation(pm.shippingAddress)
    case 'CASH':
    case 'NPP':
    case 'GENERIC_BANK_ACCOUNT':
    case 'MPESA':
    case 'CARD':
    case 'SWIFT':
      return getAddressStringForAggregation(pm.address)
    case 'IBAN':
    case 'ACH':
      return getAddressStringForAggregation(pm.bankAddress)
    case 'UPI':
    case 'WALLET':
      return undefined
  }

  return neverReturn(pm, undefined)
}

export const getPaymentEmailId = (
  pm: PaymentDetails | undefined
): string | undefined => {
  if (!pm) {
    return
  }
  switch (pm.method) {
    case 'CARD':
    case 'GENERIC_BANK_ACCOUNT':
    case 'IBAN':
    case 'ACH':
    case 'SWIFT':
    case 'UPI':
    case 'WALLET':
    case 'MPESA':
    case 'NPP':
      return pm.emailId
    case 'CHECK':
    case 'CASH':
      return undefined
  }

  return neverReturn(pm, undefined)
}
