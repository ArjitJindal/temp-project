import {
  ACHDetails,
  CardDetails,
  CheckDetails,
  GenericBankAccountDetails,
  IBANDetails,
  MpesaDetails,
  SWIFTDetails,
  UPIDetails,
  WalletDetails,
  CashDetails,
  NPPDetails,
} from '@/apis';

export type PaymentDetails =
  | CardDetails
  | GenericBankAccountDetails
  | IBANDetails
  | ACHDetails
  | UPIDetails
  | WalletDetails
  | SWIFTDetails
  | MpesaDetails
  | CheckDetails
  | CashDetails
  | NPPDetails;

export type PaymentDetailsKey =
  | keyof CardDetails
  | keyof GenericBankAccountDetails
  | keyof IBANDetails
  | keyof ACHDetails
  | keyof UPIDetails
  | keyof WalletDetails
  | keyof SWIFTDetails
  | keyof MpesaDetails
  | keyof CheckDetails
  | keyof CashDetails
  | keyof NPPDetails;
