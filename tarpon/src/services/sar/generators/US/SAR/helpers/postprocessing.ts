import {
  AddressType,
  PartyIdentificationType,
  PartyNameType,
  PartyType,
  SuspiciousActivity,
} from '../resources/EFL_SARXBatchSchema.type'
import {
  indicator,
  PartySinglePartyName,
} from '@/services/sar/generators/US/SAR/helpers/prepopulating'
import { ActivityPartyTypeCodes } from '@/services/sar/generators/US/SAR/helpers/constants'
import { PartyTypeCode } from '@/services/sar/generators/US/SAR/helpers/types'

export function fixPartyIndicators(party: PartyType): PartyType {
  const result = {
    ...party,
  }
  const partyTypeCode = party.ActivityPartyTypeCode

  result.Address = fixArray(result.Address as AddressType, fixAddressIndicators)
  result.PartyName = fixArray(
    party.PartyName as PartyNameType,
    fixPartyNameIndicators
  )
  result.PartyIdentification = fixArray(
    result.PartyIdentification as PartyIdentificationType,
    fixPartyIdentificationIndicatorsForSubject,
    partyTypeCode
  )

  if (partyTypeCode === ActivityPartyTypeCodes.SUBJECT) {
    result.BirthDateUnknownIndicator = indicator(!party.IndividualBirthDateText)
  }

  return result
}
export function fixSuspiciousActivityIndicators(
  suspiciousActivity: SuspiciousActivity | null | undefined
): SuspiciousActivity | null | undefined {
  if (suspiciousActivity == null) {
    return suspiciousActivity
  }
  const result = {
    ...suspiciousActivity,
    NoAmountInvolvedIndicator: indicator(
      !suspiciousActivity.TotalSuspiciousAmountText
    ),
    AmountUnknownIndicator: indicator(
      !suspiciousActivity.TotalSuspiciousAmountText
    ),
  }

  return result
}

function fixPartyIdentificationIndicatorsForSubject(
  partyIdentification: PartyIdentificationType | null | undefined,
  partyType?: PartyTypeCode
): PartyIdentificationType | null | undefined {
  if (partyIdentification == null) {
    return partyIdentification
  }
  const result = {
    ...partyIdentification,
  }
  if (partyType != null) {
    if (result.TINUnknownIndicator) {
      return result // already handled case
    }
    if (partyType === ActivityPartyTypeCodes.SUBJECT) {
      result.IdentificationPresentUnknownIndicator = indicator(
        !partyIdentification.OtherIssuerCountryText &&
          !partyIdentification.OtherIssuerStateText &&
          !partyIdentification.OtherPartyIdentificationTypeText &&
          !partyIdentification.PartyIdentificationNumberText &&
          !partyIdentification.PartyIdentificationTypeCode
      )
    }
    if (
      partyType === ActivityPartyTypeCodes.SUBJECT ||
      partyType ===
        ActivityPartyTypeCodes.FINANCIAL_INSTITUTION_WHERE_ACTIVITY_OCCURRED
    ) {
      result.TINUnknownIndicator = indicator(
        !partyIdentification.PartyIdentificationNumberText
      )
    }
  }
  return result
}

export function fixPartyNameIndicators(
  partyName: PartyNameType | null | undefined,
  partyType?: PartyTypeCode
): PartyNameType | null | undefined {
  if (partyName == null) {
    return partyName
  }
  const result = {
    ...partyName,
  }
  if (partyType != null) {
    if (
      ActivityPartyTypeCodes.FINANCIAL_INSTITUTION_WHERE_ACTIVITY_OCCURRED ===
      partyType
    ) {
      result.EntityLastNameUnknownIndicator = indicator(
        !partyName.RawPartyFullName
      )
    }
    if (partyType === ActivityPartyTypeCodes.SUBJECT) {
      if (partyName.PartyNameTypeCode === 'L') {
        result.EntityLastNameUnknownIndicator = indicator(
          !partyName.RawEntityIndividualLastName
        )
      }
      result.FirstNameUnknownIndicator = indicator(
        partyName.PartyNameTypeCode === 'L' && !partyName.RawIndividualFirstName
      )
    }
  }
  return result
}
export function fixFinancialInstitutionIndicators(
  partyName: PartySinglePartyName
): PartySinglePartyName {
  return {
    ...partyName,
    EntityLastNameUnknownIndicator: indicator(!partyName.RawPartyFullName),
  }
}

export function fixAddressIndicators(
  address: AddressType | null | undefined
): AddressType | null | undefined {
  if (address == null) {
    return address
  }
  return {
    ...address,
    CityUnknownIndicator: indicator(!address.RawCityText),
    CountryCodeUnknownIndicator: indicator(!address.RawCountryCodeText),
    StateCodeUnknownIndicator: indicator(!address.RawStateCodeText),
    StreetAddressUnknownIndicator: indicator(
      !address.RawStreetAddress1Text?.trim()
    ),
    ZIPCodeUnknownIndicator: indicator(!address.RawZIPCode),
  }
}

function fixArray<T, C = unknown, V = T | T[] | null | undefined>(
  value: V,
  f: (value: V, context?: C) => V,
  context?: C
): V {
  if (value == null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => f(item, context)) as V
  }
  return f(value)
}
