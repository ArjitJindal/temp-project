import { humanizeConstant } from './humanize';
import {
  ACHPaymentMethod,
  CardPaymentMethod,
  CheckPaymentMethod,
  GeneralBankAccountPaymentMethod,
  IBANPaymentMethod,
  MpesaPaymentMethod,
  SWIFTPaymentMethod,
  UPIPaymentMethod,
  WalletPaymentMethod,
  CardDetails,
  GenericBankAccountDetails,
  IBANDetails,
  ACHDetails,
  SWIFTDetails,
  UPIDetails,
  WalletDetails,
  MpesaDetails,
  CheckDetails,
} from '@/apis';
import { neverReturn } from '@/utils/lang';
import { notEmpty } from '@/utils/array';

export type PaymentDetails =
  | CardDetails
  | GenericBankAccountDetails
  | IBANDetails
  | ACHDetails
  | SWIFTDetails
  | UPIDetails
  | WalletDetails
  | MpesaDetails
  | CheckDetails;

export type PaymentMethod =
  | CardPaymentMethod
  | WalletPaymentMethod
  | GeneralBankAccountPaymentMethod
  | UPIPaymentMethod
  | IBANPaymentMethod
  | ACHPaymentMethod
  | SWIFTPaymentMethod
  | MpesaPaymentMethod
  | CheckPaymentMethod;

export const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH',
  'CARD',
  'GENERIC_BANK_ACCOUNT',
  'IBAN',
  'SWIFT',
  'UPI',
  'WALLET',
  'MPESA',
  'CHECK',
];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  const paymentMethod = value as PaymentMethod;
  switch (paymentMethod) {
    case 'CARD':
    case 'GENERIC_BANK_ACCOUNT':
    case 'IBAN':
    case 'ACH':
    case 'SWIFT':
    case 'MPESA':
    case 'UPI':
    case 'WALLET':
    case 'CHECK':
      return true;
  }
  return neverReturn(paymentMethod, false);
}

export function getPaymentDetailsIdString(paymentDetails: PaymentDetails): string {
  if (paymentDetails.method === 'IBAN') {
    return paymentDetails.IBAN ?? paymentDetails.name ?? '-';
  } else if (paymentDetails.method === 'ACH') {
    return paymentDetails.accountNumber ?? '-';
  } else if (paymentDetails.method === 'SWIFT') {
    return [paymentDetails.swiftCode, paymentDetails.accountNumber].filter(notEmpty).join('/');
  } else if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    return paymentDetails.accountNumber ?? '-';
  } else if (paymentDetails.method === 'WALLET') {
    return paymentDetails.walletId ?? '-';
  } else if (paymentDetails.method === 'UPI') {
    return paymentDetails.upiID ?? '-';
  } else if (paymentDetails.method === 'CARD') {
    return `XXXX ${paymentDetails.cardLast4Digits ?? '-'}`;
  } else if (paymentDetails.method === 'MPESA') {
    return paymentDetails.businessShortCode ?? '-';
  } else if (paymentDetails.method === 'CHECK') {
    return paymentDetails.checkIdentifier ?? '-';
  } else {
    return neverReturn(paymentDetails, '-');
  }
}

export function getPaymentMethodTitle(paymentMethod: PaymentMethod) {
  if (paymentMethod === 'IBAN') {
    return 'IBAN transfer';
  } else if (paymentMethod === 'ACH') {
    return 'ACH transfer';
  } else if (paymentMethod === 'SWIFT') {
    return 'SWIFT transfer';
  } else if (paymentMethod === 'GENERIC_BANK_ACCOUNT') {
    return 'Bank transfer';
  } else if (paymentMethod === 'WALLET') {
    return 'Wallet';
  } else if (paymentMethod === 'UPI') {
    return 'UPI';
  } else if (paymentMethod === 'CARD') {
    return 'Card';
  } else if (paymentMethod === 'MPESA') {
    return 'Mpesa';
  } else if (paymentMethod === 'CHECK') {
    return 'Check';
  } else {
    return neverReturn(paymentMethod, humanizeConstant(paymentMethod));
  }
}
