import { ACHDetails } from '../openapi-public/ACHDetails'
import { CardDetails } from '../openapi-public/CardDetails'
import { GenericBankAccountDetails } from '../openapi-public/GenericBankAccountDetails'
import { IBANDetails } from '../openapi-public/IBANDetails'
import { SWIFTDetails } from '../openapi-public/SWIFTDetails'
import { UPIDetails } from '../openapi-public/UPIDetails'
import { WalletDetails } from '../openapi-public/WalletDetails'
import { MpesaDetails } from '../openapi-public/MpesaDetails'
import { CheckDetails } from '../openapi-public/CheckDetails'
import { CashDetails } from '../openapi-public/CashDetails'
import { ACHPaymentMethod } from '../openapi-public/ACHPaymentMethod'
import { CardPaymentMethod } from '../openapi-public/CardPaymentMethod'
import { GeneralBankAccountPaymentMethod } from '../openapi-public/GeneralBankAccountPaymentMethod'
import { IBANPaymentMethod } from '../openapi-public/IBANPaymentMethod'
import { SWIFTPaymentMethod } from '../openapi-public/SWIFTPaymentMethod'
import { UPIPaymentMethod } from '../openapi-public/UPIPaymentMethod'
import { WalletPaymentMethod } from '../openapi-public/WalletPaymentMethod'
import { MpesaPaymentMethod } from '../openapi-public/MpesaPaymentMethod'
import { CheckPaymentMethod } from '../openapi-public/CheckPaymentMethod'
import { CashPaymentMethod } from '../openapi-public/CashPaymentMethod'
import { NPPDetails } from '../openapi-public/NPPDetails'
import { NPPPaymentMethod } from '../openapi-public/NPPPaymentMethod'

export type PaymentDetails =
  | CardDetails
  | GenericBankAccountDetails
  | IBANDetails
  | ACHDetails
  | SWIFTDetails
  | UPIDetails
  | WalletDetails
  | MpesaDetails
  | CheckDetails
  | CashDetails
  | NPPDetails

export type PaymentMethod =
  | CardPaymentMethod
  | GeneralBankAccountPaymentMethod
  | IBANPaymentMethod
  | ACHPaymentMethod
  | SWIFTPaymentMethod
  | UPIPaymentMethod
  | WalletPaymentMethod
  | MpesaPaymentMethod
  | CheckPaymentMethod
  | CashPaymentMethod
  | NPPPaymentMethod
