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
  | CheckDetails;

export type PaymentDetailsKey =
  | keyof CardDetails
  | keyof GenericBankAccountDetails
  | keyof IBANDetails
  | keyof ACHDetails
  | keyof UPIDetails
  | keyof WalletDetails
  | keyof SWIFTDetails
  | keyof MpesaDetails
  | keyof CheckDetails;
