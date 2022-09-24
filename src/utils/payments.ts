import {
  CardPaymentMethod,
  WalletPaymentMethod,
  GeneralBankAccountPaymentMethod,
  UPIPaymentMethod,
  IBANPaymentMethod,
  ACHPaymentMethod,
  SWIFTPaymentMethod,
  MpesaPaymentMethod,
} from '@/apis';

type PaymentMethod =
  | CardPaymentMethod
  | WalletPaymentMethod
  | GeneralBankAccountPaymentMethod
  | UPIPaymentMethod
  | IBANPaymentMethod
  | ACHPaymentMethod
  | SWIFTPaymentMethod
  | MpesaPaymentMethod;

export const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH',
  'CARD',
  'GENERIC_BANK_ACCOUNT',
  'IBAN',
  'SWIFT',
  'UPI',
  'WALLET',
  'MPESA',
];
