import pick from 'lodash/pick'
import merge from 'lodash/merge'
import omit from 'lodash/omit'
import isNumber from 'lodash/isNumber'
import cloneDeep from 'lodash/cloneDeep'
import has from 'lodash/has'
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

function pickPartyProperties(fields: string[]) {
  return pick(
    merge(
      FincenJsonSchema.definitions.PartyType.properties,
      FincenJsonSchema.definitions.Party.allOf[1].properties
    ),
    fields
  )
}

function pickPartyFields(
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  return {
    type: 'object',
    properties: {
      ...pickPartyProperties(fields),
      ...overrides,
    },
    required: requiredFields,
    ...AttributeInfos.Party,
  }
}

function arraySchema(type: any) {
  let schema: any = {
    type: 'array',
    items: type,
  }
  if (has(type, 'title')) {
    schema = {
      ...schema,
      title: type.title,
    }
  }
  if (has(type, 'description')) {
    schema = {
      ...schema,
      description: type.description,
    }
  }
  return schema
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
    ...FincenJsonSchema.definitions.AddressType,
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
    ...FincenJsonSchema.definitions.PhoneNumberType,
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
    ...AttributeInfos.PartyIdentification,
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

function pickPartyAssociationFields(
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  return {
    type: 'object',
    properties: {
      ...pick(
        merge(
          FincenJsonSchema.definitions.PartyAssociationType.properties,
          FincenJsonSchema.definitions.PartyAssociation.allOf[1].properties
        ),
        fields
      ),
      ...overrides,
    },
    required: requiredFields,
    ...AttributeInfos.PartyAssociation,
  }
}

function pickPartyAccountAssociationFields(
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  return {
    type: 'object',
    properties: {
      ...pick(
        merge(
          FincenJsonSchema.definitions.PartyAccountAssociationType.properties,
          FincenJsonSchema.definitions.PartyAccountAssociation.allOf[1]
            .properties
        ),
        fields
      ),
      ...overrides,
    },
    required: requiredFields,
    ...AttributeInfos.PartyAccountAssociation,
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
    Address: pickAddressFields(
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
    ),
    PhoneNumber: omit(
      pickPhoneNumberFields(
        ['PhoneNumberExtensionText', 'PhoneNumberText'],
        ['PhoneNumberText']
      ),
      'ui:schema'
    ),
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
    pickPartyProperties([
      'PrimaryRegulatorTypeCode',
      'OrganizationClassificationTypeSubtype',
    ]),
    {
      PartyName: pickPartyNameFields(
        ['RawPartyFullName'],
        ['RawPartyFullName']
      ),
      AlternateName: FlagrightAlternatePartyName,
      Address: pickAddressFields(
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
    PhoneNumber: omit(
      pickPhoneNumberFields(
        ['PhoneNumberExtensionText', 'PhoneNumberText'],
        ['PhoneNumberText']
      ),
      'ui:schema'
    ),
  },
  required: ['PartyName', 'PhoneNumber'],
}

// Search '34 = Financial Institution Where Activity Occurred' in the pdf
export const FinancialInstitution = {
  type: 'object',
  title: 'Financial Institution Where Activity Occurred',
  properties: merge(
    pickPartyProperties([
      'PayLocationIndicator',
      'SellingLocationIndicator',
      'SellingPayingLocationIndicator',
      'NoBranchActivityInvolvedIndicator',
      'LossToFinancialAmountText',
      'PrimaryRegulatorTypeCode',
      'OrganizationClassificationTypeSubtype',
    ]),
    {
      PartyAssociation: pickPartyAssociationFields(['Party'], [], {
        Party: pickPartyFields(
          [
            'ActivityPartyTypeCode',
            'PayLocationIndicator',
            'SellingLocationIndicator',
            'SellingPayingLocationIndicator',
            'Address',
            'PartyIdentification',
          ],
          ['ActivityPartyTypeCode'],
          {
            Address: pickAddressFields(
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
            ),
            PartyIdentification: pickPartyIdentificationFields(
              ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode'],
              ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode']
            ),
          }
        ),
      }),
      PartyName: pickPartyNameFields(
        ['EntityLastNameUnknownIndicator', 'RawPartyFullName'],
        []
      ),
      AlternateName: arraySchema(FlagrightAlternatePartyName),
      Address: pickAddressFields(
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
      ),
      FlagrightPartyIdentificationTin: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationTypeCode'],
          {
            // ref: https://github.com/moov-io/fincen/blob/eeeed6e18ba6710474db14d0ec51441b26d75b1c/pkg/suspicious_activity/activity.go#L288
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '1',
              '2',
              '9',
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
    'OrganizationClassificationTypeSubtype',
    'FlagrightPartyIdentificationTin',
  ],
}

// Search '33 = Subject' in the pdf
export const Subject = {
  type: 'object',
  properties: merge(
    pickPartyProperties([
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
    ]),
    {
      Gender: {
        type: 'string',
        'ui:schema': {
          'ui:subtype': 'FINCEN_GENDER',
          'ui:maleIndicatorField': 'FemaleGenderIndicator',
          'ui:femaleIndicatorField': 'MaleGenderIndicator',
          'ui:unknownIndicatorField': 'UnknownGenderIndicator',
        },
      },
      PartyAssociation: pickPartyAssociationFields(
        [
          'AccountantIndicator',
          'ActionTakenDateText',
          'AgentIndicator',
          'AppraiserIndicator',
          'AttorneyIndicator',
          'BorrowerIndicator',
          'CustomerIndicator',
          'DirectorIndicator',
          'EmployeeIndicator',
          'NoRelationshipToInstitutionIndicator',
          'OfficerIndicator',
          'OtherPartyAssociationTypeText',
          'OtherRelationshipIndicator',
          'OwnerShareholderIndicator',
          'RelationshipContinuesIndicator',
          'ResignedIndicator',
          'SubjectRelationshipFinancialInstitutionTINText',
          'SuspendedBarredIndicator',
          'TerminatedIndicator',
        ],
        []
      ),
      PartyAccountAssociation: pickPartyAccountAssociationFields(
        ['PartyAccountAssociationTypeCode', 'Party'],
        ['PartyAccountAssociationTypeCode', 'Party'],
        {
          Party: pickPartyFields(
            [
              'ActivityPartyTypeCode',
              'NonUSFinancialInstitutionIndicator',
              'PartyIdentification',
              'Account',
            ],
            ['ActivityPartyTypeCode', 'Account'],
            {
              PartyIdentification: pickPartyIdentificationFields(
                [
                  'PartyIdentificationNumberText',
                  'PartyIdentificationTypeCode',
                ],
                ['PartyIdentificationNumberText', 'PartyIdentificationTypeCode']
              ),
              Account: {
                type: 'object',
                properties: {
                  AccountNumberText:
                    FincenJsonSchema.definitions.AccountType.properties
                      .AccountNumberText,
                  PartyAccountAssociation: {
                    ...FincenJsonSchema.definitions.PartyAccountAssociationType,
                    properties: omit(
                      FincenJsonSchema.definitions.PartyAccountAssociationType
                        .properties,
                      'Party'
                    ),
                    ...AttributeInfos.PartyAccountAssociation,
                  },
                },
                required: ['AccountNumberText', 'PartyAccountAssociation'],
                ...AttributeInfos.Account,
              },
            }
          ),
        }
      ),
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
      AlternateName: arraySchema(FlagrightAlternatePartyName),
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
      FlagrightPartyIdentificationTin: {
        ...pickPartyIdentificationFields(
          ['PartyIdentificationNumberText'],
          ['PartyIdentificationTypeCode'],
          {
            // ref: https://github.com/moov-io/fincen/blob/eeeed6e18ba6710474db14d0ec51441b26d75b1c/pkg/suspicious_activity/activity.go#L288
            PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
              '1',
              '2',
              '9',
            ]),
          }
        ),
        title: 'TIN',
      },
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
  required: ['Address', 'FlagrightPartyIdentificationTin'],
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
