import {
  CardPaymentMethod,
  WalletPaymentMethod,
  GeneralBankAccountPaymentMethod,
  UPIPaymentMethod,
  IBANPaymentMethod,
  ACHPaymentMethod,
  SWIFTPaymentMethod,
} from '@/apis';

type PaymentMethod =
  | CardPaymentMethod
  | WalletPaymentMethod
  | GeneralBankAccountPaymentMethod
  | UPIPaymentMethod
  | IBANPaymentMethod
  | ACHPaymentMethod
  | SWIFTPaymentMethod;

export const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH',
  'CARD',
  'GENERIC_BANK_ACCOUNT',
  'IBAN',
  'SWIFT',
  'UPI',
  'WALLET',
];
