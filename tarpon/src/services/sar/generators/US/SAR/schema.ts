/**
 * Party types: Page 25 of https://bsaefiling.fincen.treas.gov/docs/XMLUserGuide_FinCENSAR.pdf
 */

import { pick, merge, omit, isNumber, cloneDeep } from 'lodash'
import { FincenJsonSchema } from './resources/EFL_SARXBatchSchema'
import { AttributeInfos } from './scripts/attribute-infos'

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
  ]),
  required: [
    'FilingDateText',
    'ActivityAssociation',
    'ActivityNarrativeInformation',
  ],
}

export const SuspiciousActivityOtherInfo = {
  type: 'object',
  title: 'Other information',
  'ui:schema': {
    'ui:group': 'Other information',
  },
  properties: pickActivityTypeFields([
    'ActivityIPAddress',
    'CyberEventIndicators',
    'Assets',
    'AssetsAttribute',
  ]),
  required: [],
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

function arraySchema(type: unknown) {
  return {
    type: 'array',
    items: type,
  }
}

function pickPartyNameFields(
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  return {
    type: 'object',
    properties: {
      ...pick(FincenJsonSchema.definitions.PartyNameType.properties, fields),
      ...overrides,
    },
    required: requiredFields,
    ...AttributeInfos.PartyName,
  }
}

const FlagrightAlternatePartyName = {
  ...pickPartyNameFields(['RawPartyFullName'], ['RawPartyFullName'], {
    PartyNameTypeCode: pickPartyNameTypeCodeSubset(['AKA', 'DBA']),
  }),
  title: 'Alternate name',
}

function pickAddressFields(fields: string[], requiredFields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.AddressType.properties,
      fields
    ),
    required: requiredFields,
    ...AttributeInfos.Address,
  }
}

function pickPhoneNumberFields(fields: string[], requiredFields: string[]) {
  return {
    type: 'object',
    properties: pick(
      FincenJsonSchema.definitions.PhoneNumberType.properties,
      fields
    ),
    required: requiredFields,
    ...AttributeInfos.PhoneNumber,
  }
}

function pickPartyIdentificationFields(
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  return {
    type: 'object',
    properties: {
      ...pick(
        FincenJsonSchema.definitions.PartyIdentificationType.properties,
        fields
      ),
      ...overrides,
    },
    required: requiredFields,
  }
}

// See page 62 in the pdf
function pickPartyIdentificationTypeCodeSubset(codes: string[]) {
  const newValidatePartyIdentificationCodeType = cloneDeep(
    FincenJsonSchema.definitions.ValidatePartyIdentificationCodeType
  )
  const enumIndexes = newValidatePartyIdentificationCodeType.enum
    .map((e, index) => (codes.includes(e) ? index : null))
    .filter(isNumber)
  newValidatePartyIdentificationCodeType.enum =
    newValidatePartyIdentificationCodeType.enum.filter((_e, index) =>
      enumIndexes.includes(index)
    )
  newValidatePartyIdentificationCodeType.enumNames =
    newValidatePartyIdentificationCodeType.enumNames.filter((_e, index) =>
      enumIndexes.includes(index)
    )
  return {
    ...newValidatePartyIdentificationCodeType,
    ...omit(
      FincenJsonSchema.definitions.PartyIdentificationType.properties
        .PartyIdentificationTypeCode,
      '$ref'
    ),
  }
}

function pickPartyNameTypeCodeSubset(codes: string[]) {
  const newValidatePartyNameCodeType = cloneDeep(
    FincenJsonSchema.definitions.ValidatePartyNameCodeType
  )
  const enumIndexes = newValidatePartyNameCodeType.enum
    .map((e, index) => (codes.includes(e) ? index : null))
    .filter(isNumber)
  newValidatePartyNameCodeType.enum = newValidatePartyNameCodeType.enum.filter(
    (_e, index) => enumIndexes.includes(index)
  )
  newValidatePartyNameCodeType.enumNames =
    newValidatePartyNameCodeType.enumNames.filter((_e, index) =>
      enumIndexes.includes(index)
    )
  return {
    ...newValidatePartyNameCodeType,
    ...omit(
      FincenJsonSchema.definitions.PartyNameType.properties.PartyNameTypeCode,
      '$ref'
    ),
    ...AttributeInfos.PartyIdentification,
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
    PartyName: pickPartyNameFields(['RawPartyFullName'], ['RawPartyFullName']),
    Address: arraySchema(
      pickAddressFields(
        [
          'RawCityText',
          'RawCountryCodeText',
          'RawStateCodeText',
          'RawStreetAddress1Text',
          'RawZIPCode',
        ],
        [
          'RawCityText',
          'RawCountryCodeText',
          'RawStateCodeText',
          'RawStreetAddress1Text',
          'RawZIPCode',
        ]
      )
    ),
    PhoneNumber: arraySchema(
      pickPhoneNumberFields(['PhoneNumberText'], ['PhoneNumberText'])
    ),
    FlagrightPartyIdentificationTcc: {
      ...pickPartyIdentificationFields(
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Transmitter Control Code (TCC)',
    },
    FlagrightPartyIdentificationTin: {
      ...pickPartyIdentificationFields(
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Taxpayer Identification Number (TIN)',
    },
  },
  required: [
    'PartyName',
    'Address',
    'PhoneNumber',
    'FlagrightPartyIdentificationTcc',
    'FlagrightPartyIdentificationTin',
  ],
}

// Search '37 = Transmitter Contact' in the pdf
export const TransmitterContact = {
  type: 'object',
  title: 'Transmitter contact',
  description: 'This is the official contact for the transmitter.',
  'ui:schema': {
    'ui:group': 'Transmitter contact information',
  },
  properties: {
    PartyName: pickPartyNameFields(['RawPartyFullName'], ['RawPartyFullName']),
  },
  required: ['PartyName'],
}

// Search '30 = Filing institution' in the pdf
export const FilingInstitution = {
  type: 'object',
  title: 'Filing institution',
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
      PartyName: pickPartyNameFields(
        ['RawPartyFullName'],
        ['RawPartyFullName']
      ),
      FlagrightAlternatePartyName,
      Address: arraySchema(
        pickAddressFields(
          [
            'RawCityText',
            'RawCountryCodeText',
            'RawStateCodeText',
            'RawStreetAddress1Text',
            'RawZIPCode',
          ],
          [
            'RawCityText',
            'RawCountryCodeText',
            'RawStateCodeText',
            'RawStreetAddress1Text',
            'RawZIPCode',
          ]
        )
      ),
      FlagrightPartyIdentificationTin: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode'],
          {
            // ref: https://github.com/moov-io/fincen/blob/eeeed6e18ba6710474db14d0ec51441b26d75b1c/pkg/suspicious_activity/activity.go#L267
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '2',
            ]),
          }
        ),
        title: 'TIN',
      },
      FlagrightPartyIdentificationFilingInstitutionIdentification: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode'],
          {
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '10',
              '11',
              '12',
              '13',
              '14',
              '32',
              '33',
            ]),
          }
        ),
        title: 'Filing institution identification (CRD, IARD, etc.)',
      },
      FlagrightPartyIdentificationInternalControl: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationNumberText']
        ),
        title: 'Internal control/file number',
      },
    }
  ),
  required: [
    'PrimaryRegulatorTypeCode',
    'PartyName',
    'Address',
    'FlagrightPartyIdentificationTin',
    'OrganizationClassificationTypeSubtype',
  ],
}

// Search '8 = Contact Office' in the pdf
export const ContactOffice = {
  type: 'object',
  title: 'Designated contact office',
  description:
    'This is the administrative office that should be contacted to obtain additional information about the FinCEN SAR.',
  'ui:schema': {
    'ui:group': 'Designated contact office',
  },
  properties: {
    PartyName: pickPartyNameFields(['RawPartyFullName'], ['RawPartyFullName']),
    PhoneNumber: arraySchema(
      pickPhoneNumberFields(
        ['PhoneNumberExtensionText', 'PhoneNumberText'],
        ['PhoneNumberText']
      )
    ),
  },
  required: ['PartyName', 'PhoneNumber'],
}

// Search '34 = Financial Institution Where Activity Occurred' in the pdf
export const FinancialInstitution = {
  type: 'object',
  title: 'Financial Institution Where Activity Occurred',
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
      PartyName: pickPartyNameFields(
        ['EntityLastNameUnknownIndicator', 'RawPartyFullName'],
        []
      ),
      FlagrightAlternatePartyName: arraySchema(FlagrightAlternatePartyName),
      Address: arraySchema(
        pickAddressFields(
          [
            'CityUnknownIndicator',
            'CountryCodeUnknownIndicator',
            'RawCityText',
            'RawCountryCodeText',
            'RawStateCodeText',
            'RawStreetAddress1Text',
            'RawZIPCode',
            'StreetAddressUnknownIndicator',
            'ZIPCodeUnknownIndicator',
          ],
          []
        )
      ),
      FlagrightPartyIdentificationTin: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText', 'TINUnknownIndicator'],
          ['PartyIdentificationTypeCode'],
          {
            // ref: https://github.com/moov-io/fincen/blob/eeeed6e18ba6710474db14d0ec51441b26d75b1c/pkg/suspicious_activity/activity.go#L288
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '2',
            ]),
          }
        ),
        title: 'TIN',
      },
      FlagrightPartyIdentificationFinancialInstitutionIdentification: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode'],
          {
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '10',
              '11',
              '12',
              '13',
              '14',
              '32',
              '33',
            ]),
          }
        ),
        title: 'Financial institution identification (CRD, IARD, etc.)',
      },
      FlagrightPartyIdentificationInternalControl: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationNumberText']
        ),
        title: 'Internal control/file number',
      },
    }
  ),
  required: [
    'PrimaryRegulatorTypeCode',
    'PartyName',
    'Address',
    'FlagrightPartyIdentificationTin',
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
      // TODO: Fix PartyAccountAssociation
      // 'PartyAccountAssociation',
    ]),
    {
      PartyName: pickPartyNameFields(
        [
          'EntityLastNameUnknownIndicator',
          'FirstNameUnknownIndicator',
          'RawEntityIndividualLastName',
          'RawIndividualFirstName',
          'RawIndividualMiddleName',
          'RawIndividualNameSuffixText',
        ],
        []
      ),
      FlagrightAlternatePartyName: arraySchema(FlagrightAlternatePartyName),
      Address: arraySchema(
        pickAddressFields(
          [
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
          ],
          []
        )
      ),
      PhoneNumber: arraySchema(
        pickPhoneNumberFields(
          [
            'PhoneNumberExtensionText',
            'PhoneNumberText',
            'PhoneNumberTypeCode',
          ],
          []
        )
      ),
      PartyIdentification: arraySchema({
        ...pickPartyIdentificationFields(
          [
            'PartyIdentificationNumberText',
            'TINUnknownIndicator',
            'IdentificationPresentUnknownIndicator',
            'OtherIssuerCountryText',
            'OtherIssuerStateText',
            'OtherPartyIdentificationTypeText',
            'PartyIdentificationNumberText',
          ],
          ['PartyIdentificationTypeCode'],
          {
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '2',
              '1',
              '9',
              '5',
              '6',
              '7',
              '999',
            ]),
          }
        ),
      }),
    }
  ),
  required: ['Address', 'PartyIdentification'],
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

export const FinancialInstitutions = {
  type: 'array',
  title: 'Financial Institution Where Activity Occurred',
  description:
    'This is the financial institution where the suspicious activity occurred.',
  'ui:schema': {
    'ui:group': 'Financial institution where activity occurred ',
  },
  items: FinancialInstitution,
}
