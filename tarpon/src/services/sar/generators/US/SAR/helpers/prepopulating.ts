import {
  AddressType,
  DateYYYYMMDDOrBlankTypeDOB,
  ElectronicAddressType,
  PartyNameType,
  PhoneNumberType,
  RestrictString15,
  ValidateIndicatorType,
} from '../resources/EFL_SARXBatchSchema.type'
import { ConsumerName } from '@/@types/openapi-internal/ConsumerName'
import { CompanyGeneralDetails } from '@/@types/openapi-internal/CompanyGeneralDetails'
import { CardDetails } from '@/@types/openapi-internal/CardDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-internal/GenericBankAccountDetails'
import { IBANDetails } from '@/@types/openapi-internal/IBANDetails'
import { ACHDetails } from '@/@types/openapi-internal/ACHDetails'
import { SWIFTDetails } from '@/@types/openapi-internal/SWIFTDetails'
import { MpesaDetails } from '@/@types/openapi-internal/MpesaDetails'
import { UPIDetails } from '@/@types/openapi-internal/UPIDetails'
import { WalletDetails } from '@/@types/openapi-internal/WalletDetails'
import { CheckDetails } from '@/@types/openapi-internal/CheckDetails'
import { Address } from '@/@types/openapi-internal/Address'
import dayjs from '@/utils/dayjs'
import { neverReturn } from '@/utils/lang'

/*
  Helpers to convert Flagright's data structures to FinCEN data structures
 */

export function indicator(value: boolean): ValidateIndicatorType {
  return value ? 'Y' : ''
}

export function partyNameByConsumerName(
  consumerName: ConsumerName
): PartyNameType {
  return {
    PartyNameTypeCode: 'L',
    RawEntityIndividualLastName: consumerName.lastName,
    RawIndividualFirstName: consumerName.firstName,
    RawIndividualMiddleName: consumerName.middleName,
  }
}

export function partyNameByCompanyGeneralDetails(
  details: CompanyGeneralDetails
): PartyNameType {
  return {
    PartyNameTypeCode: 'L',
    RawEntityIndividualLastName: details.legalName,
  }
}

export function partyNameByPaymentDetails(
  paymentDetails:
    | CardDetails
    | GenericBankAccountDetails
    | IBANDetails
    | ACHDetails
    | SWIFTDetails
    | MpesaDetails
    | UPIDetails
    | WalletDetails
    | CheckDetails
): string | undefined {
  switch (paymentDetails.method) {
    case 'IBAN':
      return paymentDetails.bankName
    case 'GENERIC_BANK_ACCOUNT':
      return paymentDetails.bankName
    case 'ACH':
      return paymentDetails.bankName
    case 'SWIFT':
      return paymentDetails.bankName
    case 'UPI':
      return paymentDetails.bankProvider
    case 'CARD':
    case 'MPESA':
    case 'WALLET':
    case 'CHECK':
      return undefined
  }
  return neverReturn(paymentDetails, undefined)
}

export function address(address: Address): AddressType {
  return {
    RawZIPCode: address.postcode,
    RawCountryCodeText: address.country,
    RawCityText: address.city,
    RawStateCodeText: address.state,
    RawStreetAddress1Text: address.addressLines.join('\n'),
    // CityUnknownIndicator: undefined,
    // CountryCodeUnknownIndicator: undefined,
    // StateCodeUnknownIndicator: undefined,
    // StreetAddressUnknownIndicator: undefined,
    // ZIPCodeUnknownIndicator: undefined,
  }
}

export function phone(contactNumber: string): PhoneNumberType {
  return {
    PhoneNumberExtensionText: undefined,
    PhoneNumberText: contactNumber,
    PhoneNumberTypeCode: 'R',
  }
}

export function phoneByFax(faxNumber: string): PhoneNumberType {
  return {
    PhoneNumberExtensionText: undefined,
    PhoneNumberText: faxNumber,
    PhoneNumberTypeCode: 'F',
  }
}

export function electronicAddressByEmail(email: string): ElectronicAddressType {
  return {
    ElectronicAddressText: email,
    ElectronicAddressTypeCode: 'E',
  }
}

export function electronicAddressByWebsite(url: string): ElectronicAddressType {
  return {
    ElectronicAddressText: url,
    ElectronicAddressTypeCode: 'U',
  }
}

export function dateToDate(date: Date): DateYYYYMMDDOrBlankTypeDOB {
  return dayjs(date).format('YYYYMMDD')
}

export function amount(number: number): RestrictString15 {
  // todo: which rounding we should use here?
  /*
  Monetary Amounts: Record all monetary amounts in U.S. Dollars rounded up to the next whole dollar. The
amount $5,265.25 would be rounded up to $5,266. If the amount involves a foreign currency, record the
currency name, amount, and country of origin in Part V. When converting a foreign currency to U.S. Dollars
use an exchange rate for the date or dates the foreign currency was involved in the suspicious activity.
   */
  return `${Math.round(number)}`
}
