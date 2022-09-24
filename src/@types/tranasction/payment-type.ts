import { ACHDetails } from '../openapi-public/ACHDetails'
import { ACHPaymentMethod } from '../openapi-public/ACHPaymentMethod'
import { CardDetails } from '../openapi-public/CardDetails'
import { CardPaymentMethod } from '../openapi-public/CardPaymentMethod'
import { GenericBankAccountDetails } from '../openapi-public/GenericBankAccountDetails'
import { IBANDetails } from '../openapi-public/IBANDetails'
import { IBANPaymentMethod } from '../openapi-public/IBANPaymentMethod'
import { SWIFTDetails } from '../openapi-public/SWIFTDetails'
import { SWIFTPaymentMethod } from '../openapi-public/SWIFTPaymentMethod'
import { UPIDetails } from '../openapi-public/UPIDetails'
import { UPIPaymentMethod } from '../openapi-public/UPIPaymentMethod'
import { WalletDetails } from '../openapi-public/WalletDetails'
import { WalletPaymentMethod } from '../openapi-public/WalletPaymentMethod'
import { MpesaPaymentMethod } from '../openapi-public/MpesaPaymentMethod'
import { MpesaDetails } from '../openapi-public/MpesaDetails'

export type PaymentDetails =
  | CardDetails
  | GenericBankAccountDetails
  | IBANDetails
  | ACHDetails
  | SWIFTDetails
  | UPIDetails
  | WalletDetails
  | MpesaDetails

export type PaymentMethod =
  | CardPaymentMethod
  | GenericBankAccountDetails
  | IBANPaymentMethod
  | ACHPaymentMethod
  | SWIFTPaymentMethod
  | UPIPaymentMethod
  | WalletPaymentMethod
  | MpesaPaymentMethod
