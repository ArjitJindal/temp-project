/**
 * Party types: Page 25 of https://bsaefiling.fincen.treas.gov/docs/XMLUserGuide_FinCENSAR.pdf
 */

import { pick, merge } from 'lodash'
import { FincenJsonSchema } from './resources/EFL_SARXBatchSchema'

function pickActivityTypeFields(fields: string[]) {
  return pick(
    merge(
      FincenJsonSchema.definitions.ActivityType.properties,
      FincenJsonSchema.definitions.Activity.allOf[1].properties
    ),
    fields
  )
}
export const GeneralInfo = {
  type: 'object',
  title: 'General information',
  'ui:schema': {
    'ui:group': 'General information',
  },
  properties: pickActivityTypeFields([
    'FilingDateText',
    'ActivityAssociation',
    'ActivityNarrativeInformation',
    'EFilingPriorDocumentNumber',
    'FilingInstitutionNotetoFinCEN',
    'ActivitySupportDocument',
    'ActivityIPAddress',
    'CyberEventIndicators',
    'Assets',
    'AssetsAttribute',
  ]),
  required: [
    'FilingDateText',
    'ActivityAssociation',
    'ActivityNarrativeInformation',
  ],
}

function pickPartyFields(fields: string[]) {
  return pick(
    merge(
      FincenJsonSchema.definitions.PartyType.properties,
      FincenJsonSchema.definitions.Party.allOf[1].properties
    ),
    fields
  )
}

function pickPartyNameFields(fields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.PartyNameType.properties,
      fields
    ),
  }
}

function pickAddressFields(fields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.AddressType.properties,
      fields
    ),
  }
}

function pickPhoneNumberFields(fields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.PhoneNumberType.properties,
      fields
    ),
  }
}

function pickPartyIdentificationFields(fields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.PartyIdentificationType.properties,
      fields
    ),
  }
}

// Search '35 = Transmitter' in the pdf
export const Transmitter = {
  type: 'object',
  title: 'Transmitter',
  description:
    'This is the person (individual or entity) handling the data accumulation and formatting of the batch file.',
  'ui:schema': {
    'ui:group': 'Transmitter information',
  },
  properties: {
    PartyName: pickPartyNameFields(['RawPartyFullName']),
    Address: pickAddressFields([
      'RawCityText',
      'RawCountryCodeText',
      'RawStateCodeText',
      'RawStreetAddress1Text',
      'RawZIPCode',
    ]),
    PhoneNumber: pickPhoneNumberFields(['PhoneNumberText']),
    PartyIdentification: pickPartyIdentificationFields([
      'PartyIdentificationNumberText',
    ]),
  },
  required: ['PartyName', 'Address', 'PhoneNumber', 'PartyIdentification'],
}

// Search '37 = Transmitter Contact' in the pdf
export const TransmitterContact = {
  type: 'object',
  title: 'Transmitter Contact',
  description: 'This is the official contact for the transmitter.',
  'ui:schema': {
    'ui:group': 'Transmitter contact information',
  },
  properties: { PartyName: pickPartyNameFields(['RawPartyFullName']) },
  required: ['PartyName'],
}

// Search '30 = Filing Institution' in the pdf
export const FilingInstitution = {
  type: 'object',
  title: 'Filing Institution',
  description:
    'This is the entity responsible for filing the FinCEN SAR, such as a reporting financial institution or a holding or other parent company filling for its subsidiaries.',
  'ui:schema': {
    'ui:group': 'Filing institution',
  },
  properties: merge(
    pickPartyFields([
      'PrimaryRegulatorTypeCode',
      'OrganizationClassificationTypeSubtype',
    ]),
    {
      PartyName: pickPartyNameFields(['RawPartyFullName']),
      Address: pickAddressFields([
        'RawCityText',
        'RawCountryCodeText',
        'RawStateCodeText',
        'RawStreetAddress1Text',
        'RawZIPCode',
      ]),
      PartyIdentification: pickPartyIdentificationFields([
        'PartyIdentificationNumberText',
      ]),
    }
  ),
  required: [
    'PrimaryRegulatorTypeCode',
    'PartyName',
    'Address',
    'PartyIdentification',
    'OrganizationClassificationTypeSubtype',
  ],
}

// Search '8 = Contact Office' in the pdf
export const ContactOffice = {
  type: 'object',
  title: 'Designated Contact Office',
  description:
    'This is the administrative office that should be contacted to obtain additional information about the FinCEN SAR.',
  'ui:schema': {
    'ui:group': 'Designated contact office',
  },
  properties: {
    PartyName: pickPartyNameFields(['RawPartyFullName']),
    PhoneNumber: pickPhoneNumberFields([
      'PhoneNumberExtensionText',
      'PhoneNumberText',
    ]),
  },
  required: ['PartyName', 'PhoneNumber'],
}

// Search '34 = Financial Institution Where Activity Occurred' in the pdf
export const FinancialInstitution = {
  type: 'object',
  title: 'Financial Institution Where Activity Occurred',
  description:
    'This is the financial institution where the suspicious activity occurred.',
  'ui:schema': {
    'ui:group': 'Financial institution where activity occurred ',
  },
  properties: merge(
    pickPartyFields([
      'PayLocationIndicator',
      'SellingLocationIndicator',
      'SellingPayingLocationIndicator',
      'NoBranchActivityInvolvedIndicator',
      'LossToFinancialAmountText',
      'PrimaryRegulatorTypeCode',
      'OrganizationClassificationTypeSubtype',
      'PartyAssociation',
    ]),
    {
      PartyName: pickPartyNameFields([
        'EntityLastNameUnknownIndicator',
        'RawPartyFullName',
      ]),
      Address: pickAddressFields([
        'CityUnknownIndicator',
        'CountryCodeUnknownIndicator',
        'RawCityText',
        'RawCountryCodeText',
        'RawStateCodeText',
        'RawStreetAddress1Text',
        'RawZIPCode',
        'StreetAddressUnknownIndicator',
        'ZIPCodeUnknownIndicator',
      ]),
      PartyIdentification: pickPartyIdentificationFields([
        'PartyIdentificationNumberText',
        'TINUnknownIndicator',
      ]),
    }
  ),
  required: [
    'PrimaryRegulatorTypeCode',
    'PartyName',
    'Address',
    'PartyIdentification',
    'OrganizationClassificationTypeSubtype',
  ],
}

// Search '33 = Subject' in the pdf
export const Subject = {
  type: 'object',
  properties: merge(
    pickPartyFields([
      'AdmissionConfessionNoIndicator',
      'AdmissionConfessionYesIndicator',
      'AllCriticalSubjectInformationUnavailableIndicator',
      'BirthDateUnknownIndicator',
      'BothPurchaserSenderPayeeReceiveIndicator',
      'FemaleGenderIndicator',
      'MaleGenderIndicator',
      'NoKnownAccountInvolvedIndicator',
      'PartyAsEntityOrganizationIndicator',
      'PayeeReceiverIndicator',
      'PurchaserSenderIndicator',
      'UnknownGenderIndicator',
      'IndividualBirthDateText',
      'PartyOccupationBusiness',
      'ElectronicAddress',
      'PartyAssociation',
      'PartyAccountAssociation',
    ]),
    {
      PartyName: pickPartyNameFields([
        'EntityLastNameUnknownIndicator',
        'FirstNameUnknownIndicator',
        'RawEntityIndividualLastName',
        'RawIndividualFirstName',
        'RawIndividualMiddleName',
        'RawIndividualNameSuffixText',
      ]),
      Address: pickAddressFields([
        'CityUnknownIndicator',
        'CountryCodeUnknownIndicator',
        'RawCityText',
        'RawCountryCodeText',
        'RawStateCodeText',
        'RawStreetAddress1Text',
        'RawZIPCode',
        'StateCodeUnknownIndicator',
        'StreetAddressUnknownIndicator',
        'ZIPCodeUnknownIndicator',
      ]),
      PhoneNumber: pickPhoneNumberFields([
        'PhoneNumberExtensionText',
        'PhoneNumberText',
        'PhoneNumberTypeCode',
      ]),
      PartyIdentification: pickPartyIdentificationFields([
        'PartyIdentificationNumberText',
        'TINUnknownIndicator',
        'IdentificationPresentUnknownIndicator',
        'OtherIssuerCountryText',
        'OtherIssuerStateText',
        'OtherPartyIdentificationTypeText',
        'PartyIdentificationNumberText',
        'PartyIdentificationTypeCode',
      ]),
    }
  ),
  required: ['PartyName', 'Address', 'PartyIdentification'],
}

export const SuspiciousActivity = {
  title: 'Suspicious Activity',
  description:
    'Information about the suspicious activity, such as the total amount involved and the type of suspicious activity.',
  'ui:schema': {
    'ui:group': 'Suspicious activity information',
  },
  ...FincenJsonSchema.definitions.SuspiciousActivity,
}

export const Subjects = {
  type: 'array',
  title: 'Subjects',
  description: 'The subjects involved in the suspicious activity.',
  items: Subject,
  'ui:schema': {
    'ui:group': 'Subjects',
  },
}
