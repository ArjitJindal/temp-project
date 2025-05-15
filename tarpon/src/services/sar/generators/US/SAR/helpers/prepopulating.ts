import {
  AddressType,
  CumulativeAmount,
  DateOfBirth,
  ElectronicAddressType,
  InstitutionTypeCode,
  JointReportIndicator,
  OrganizationClassificationTypeSubtypeType,
  Party,
  PartyNameType,
  PhoneNumberType,
} from '../resources/EFL_SARXBatchSchema.type'
import { ConsumerName } from '@/@types/openapi-internal/ConsumerName'
import { CompanyGeneralDetails } from '@/@types/openapi-internal/CompanyGeneralDetails'
import { Address } from '@/@types/openapi-internal/Address'
import dayjs from '@/utils/dayjs'
import { neverReturn } from '@/utils/lang'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CardMerchantDetails } from '@/@types/openapi-public/CardMerchantDetails'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { ActivityPartyTypeCodes } from '@/services/sar/generators/US/SAR/helpers/constants'
import {
  normalizeCountryCode,
  normalizeCountryRegionCode,
} from '@/utils/countries'

export type PartySinglePartyName = Omit<Party, 'PartyName'> & {
  PartyName: PartyNameType
}

/*
  Helpers to convert Flagright's data structures to FinCEN data structures
 */

export function indicator(
  value: boolean | undefined | null
): JointReportIndicator | undefined {
  return value ? 'Y' : undefined
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
    RawPartyFullName: details.legalName,
  }
}

export function financialInstitutionByPaymentDetails(
  paymentDetails: PaymentDetails,
  options: {
    directions?: RuleHitDirection[]
  } = {}
): PartySinglePartyName {
  const { directions = [] } = options
  const partyName = partyNameByPaymentDetails(paymentDetails)
  const orgType = organizationClassificationByPaymentDetails(paymentDetails)
  const address = addressByPaymentDetails(paymentDetails)
  return {
    ActivityPartyTypeCode:
      ActivityPartyTypeCodes.FINANCIAL_INSTITUTION_WHERE_ACTIVITY_OCCURRED,
    PartyName: partyName,
    PayLocationIndicator: indicator(directions.includes('ORIGIN')),
    SellingLocationIndicator: indicator(directions.includes('DESTINATION')),
    OrganizationClassificationTypeSubtype: orgType ? [orgType] : undefined,
    Address: address ? [address] : undefined,
    // PrimaryRegulatorTypeCode: null,
  }
}

export function partyNameByPaymentDetails(
  paymentDetails: PaymentDetails
): PartyNameType {
  let name
  if (paymentDetails.method === 'IBAN') {
    name = paymentDetails.bankName
  } else if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    name = paymentDetails.bankName
  } else if (paymentDetails.method === 'ACH') {
    name = paymentDetails.bankName
  } else if (paymentDetails.method === 'SWIFT') {
    name = paymentDetails.bankName
  } else if (paymentDetails.method === 'UPI') {
    name = paymentDetails.bankProvider
  } else if (paymentDetails.method === 'NPP') {
    name = paymentDetails.bankName
  } else if (
    paymentDetails.method === 'CARD' ||
    paymentDetails.method === 'MPESA' ||
    paymentDetails.method === 'WALLET' ||
    paymentDetails.method === 'CHECK' ||
    paymentDetails.method === 'CASH'
  ) {
    name = undefined
  } else {
    name = neverReturn(paymentDetails, undefined)
  }
  return {
    PartyNameTypeCode: 'L',
    RawPartyFullName: name,
  }
}

export function organizationClassificationByPaymentDetails(
  paymentDetails: PaymentDetails
): OrganizationClassificationTypeSubtypeType | undefined {
  let type: InstitutionTypeCode | undefined = undefined
  if (
    paymentDetails.method === 'IBAN' ||
    paymentDetails.method === 'GENERIC_BANK_ACCOUNT' ||
    paymentDetails.method === 'ACH' ||
    paymentDetails.method === 'SWIFT' ||
    paymentDetails.method === 'CHECK' ||
    paymentDetails.method === 'CARD' ||
    paymentDetails.method === 'UPI' ||
    paymentDetails.method === 'NPP'
  ) {
    type = '2' // 'Depository institution' for banks
  } else if (
    paymentDetails.method === 'MPESA' ||
    paymentDetails.method === 'WALLET' ||
    paymentDetails.method === 'CASH'
  ) {
    type = '4' // MSB (Money Service Business)
  } else {
    type = neverReturn(paymentDetails, undefined)
  }
  return type
    ? {
        // OrganizationSubtypeID: '',
        OrganizationTypeID: type,
        // OtherOrganizationSubTypeText: '',
        // OtherOrganizationTypeText: '',
      }
    : undefined
}

export function addressCountryCode(
  countryText: string | undefined
): AddressType['RawCountryCodeText'] | undefined {
  if (countryText == null) {
    return undefined
  }
  const countryCode = normalizeCountryCode(countryText)
  return countryCode || undefined
}

export function addressStateCode(
  countryText: string | undefined,
  stateText: string | undefined
): AddressType['RawStateCodeText'] | undefined {
  if (countryText == null || stateText == null) {
    return undefined
  }
  const countryCode = normalizeCountryCode(countryText)
  let stateCode: string | undefined
  if (countryCode) {
    stateCode = normalizeCountryRegionCode(countryCode, stateText) ?? undefined
  }
  return stateCode
}

export function address(address: Address): AddressType {
  return {
    RawZIPCode: address.postcode,
    RawCountryCodeText: addressCountryCode(address.country),
    RawCityText: address.city,
    RawStateCodeText: addressStateCode(address.country, address.state),
    RawStreetAddress1Text: address.addressLines.join(' \n'),
  }
}

export function addressByCardMerchantDetails(
  address: CardMerchantDetails
): AddressType {
  return {
    RawZIPCode: address.postCode,
    RawCountryCodeText: addressCountryCode(address.country),
    RawCityText: address.city,
    RawStateCodeText: addressStateCode(address.country, address.state),
    RawStreetAddress1Text: undefined,
  }
}

export function addressByPaymentDetails(
  paymentDetails: PaymentDetails
): AddressType | undefined {
  if (
    paymentDetails.method === 'GENERIC_BANK_ACCOUNT' ||
    paymentDetails.method === 'IBAN' ||
    paymentDetails.method === 'ACH' ||
    paymentDetails.method === 'SWIFT'
  ) {
    if (paymentDetails.bankAddress) {
      return address(paymentDetails.bankAddress)
    }
  } else if (paymentDetails.method === 'CARD') {
    if (paymentDetails.merchantDetails) {
      return addressByCardMerchantDetails(paymentDetails.merchantDetails)
    }
  } else if (
    paymentDetails.method === 'CHECK' ||
    paymentDetails.method === 'UPI' ||
    paymentDetails.method === 'MPESA' ||
    paymentDetails.method === 'WALLET' ||
    paymentDetails.method === 'CASH' ||
    paymentDetails.method === 'NPP'
  ) {
    return undefined
  } else {
    return neverReturn(paymentDetails, undefined)
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

export function dateToDate(date: Date): DateOfBirth {
  return dayjs(date).format('YYYYMMDD')
}

export function amount(number: number): CumulativeAmount {
  // todo: which rounding we should use here?
  /*
  Monetary Amounts: Record all monetary amounts in U.S. Dollars rounded up to the next whole dollar. The
amount $5,265.25 would be rounded up to $5,266. If the amount involves a foreign currency, record the
currency name, amount, and country of origin in Part V. When converting a foreign currency to U.S. Dollars
use an exchange rate for the date or dates the foreign currency was involved in the suspicious activity.
   */
  return `${Math.round(number)}`
}
