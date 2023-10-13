import { capitalizeWords } from './humanize';
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
} from '@/apis';
import { neverReturn } from '@/utils/lang';

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
    return neverReturn(paymentMethod, capitalizeWords(paymentMethod));
  }
}
