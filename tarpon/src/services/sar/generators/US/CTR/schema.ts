import { pick, cloneDeep, isNumber, omit, merge } from 'lodash'
import { AttributeInfos } from '../SAR/scripts/attribute-infos'
import { FincenJsonSchema } from './resources/EFL_CTRXBatchSchema'
import { FincenJsonSchemaResolved } from './resources/EFL_CTRXBatchSchema_Resolved'

function pickEntityFields(
  entityName: string,
  fields: string[],
  requiredFields: string[],
  overrides = {}
) {
  try {
    const properties: object =
      FincenJsonSchema.definitions[entityName].properties
    return {
      type: 'object',
      properties: {
        ...pick(properties, fields),
        ...overrides,
      },
      required: requiredFields,
      ...AttributeInfos[entityName.replace('Type', '')],
    }
  } catch (e) {
    console.error(entityName, e)
  }
}

function pickResolvedEntityFields(
  entityName: string,
  fields: string[],
  requiredFields: string[],
  overrides: object = {}
) {
  try {
    let properties: Record<string, any> = FincenJsonSchemaResolved.definitions[
      entityName
    ].properties
      ? FincenJsonSchemaResolved.definitions[entityName].properties
      : {}

    FincenJsonSchemaResolved.definitions[entityName].allOf?.forEach(
      (value: any) => {
        if (value.properties) {
          properties = merge(properties, value.properties)
        }
      }
    )

    const picked = cloneDeep(pick(properties, fields))
    const result: Record<string, any> = {}

    for (const [key, overrideValue] of Object.entries(overrides)) {
      if (picked[key]) {
        const original = picked[key]
        const merged = merge({}, original)

        Object.keys(overrideValue).forEach((key) => {
          if (key !== 'properties') {
            merged[key] = merge(merge[key], overrideValue[key])
          }
        })

        // Deep merge override subfields into `properties`
        if (overrideValue.properties) {
          merged.properties = merged.properties || {}

          // Ordered insertion: put override keys first
          const mergedProperties: Record<string, any> = {}
          for (const [innerKey, innerOverride] of Object.entries(
            overrideValue.properties
          )) {
            const existing = merged.properties[innerKey] || {}
            mergedProperties[innerKey] = merge({}, existing, innerOverride)
          }

          // Add any remaining original fields not in override
          const remainingInner = omit(
            merged.properties,
            Object.keys(overrideValue.properties)
          )
          Object.assign(mergedProperties, remainingInner)

          merged.properties = mergedProperties
        }

        // Merge other root-level values (like `title`, `required`)
        result[key] = merge({}, merged, omit(overrideValue, ['properties']))
      } else {
        // If field didn't exist in base schema, just insert override
        result[key] = overrideValue
      }
    }

    // Append remaining picked fields (not in overrides)
    const remaining = omit(picked, Object.keys(overrides))
    Object.assign(result, remaining)
    console.log(entityName, result)
    return {
      type: 'object',
      properties: result,
      required: requiredFields,
    }
  } catch (e) {
    console.error(entityName, e)
  }
}

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

function pickActivityPartyTypeCodeSubset(codes: string[]) {
  const newValidatePartyIdentificationCodeType = cloneDeep(
    FincenJsonSchema.definitions.ValidateActivityPartyCodeType
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

const UserNotes = {
  description:
    'Use this field for any descriptive information you may require. This information will be returned in the acknowledgement file.',
  ...FincenJsonSchema.definitions.RestrictString9,
}

export const Transmitter = {
  type: 'object',
  title: 'Transmitter',
  description:
    'This is the person (individual or entity) handling the data accumulation and formatting of the batch file.',
  'ui:schema': {
    'ui:group': 'Transmitter information',
  },
  properties: {
    TransmitterName: {
      ...pickEntityFields(
        'PartyNameType',
        ['PartyNameTypeCode', 'RawPartyFullName'],
        ['PartyNameTypeCode', 'RawPartyFullName']
      ),
      title: 'Transmitter name',
      description:
        'Enter the full name of the individual or organization that is transmitting the reports in this file.',
    },
    TransmitterAddress: pickEntityFields(
      'AddressType',
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
    TransmitterTelephoneNumber: pickEntityFields(
      'PhoneNumberType',
      ['PhoneNumberExtensionText', 'PhoneNumberText'],
      ['PhoneNumberText']
    ),
    TransmitterContactName: {
      ...pickEntityFields(
        'PartyNameType',
        ['PartyNameTypeCode', 'RawPartyFullName'],
        ['PartyNameTypeCode', 'RawPartyFullName']
      ),
      title: 'Transmitter contact name',
      description: 'Enter the name of an official contact for the transmitter.',
    },
    TransmitterTin: {
      //4
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Transmitter TIN',
    },
    TransmitterControlCode: {
      //28
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Transmitter Control Code (TCC)',
    },
    UserNotes: {
      ...UserNotes,
      title: 'Notes',
      description:
        'Use this field for any descriptive information you may require',
    },
  },
  required: [
    'TransmitterName',
    'TransmitterAddress',
    'TransmitterTelephoneNumber',
    'TransmitterContactName',
    'TransmitterTin',
    'TransmitterControlCode',
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
    PartyName: pickEntityFields(
      'PartyNameType',
      ['PartyNameTypeCode', 'RawPartyFullName'],
      ['PartyNameTypeCode', 'RawPartyFullName']
    ),
  },
  required: ['PartyName'],
}

// Search '30 = Filing institution' in the pdf
export const FilingInstitution = {
  type: 'object',
  title: 'Parent Financial Institution',
  description:
    'This is the entity responsible for filing the FinCEN SAR, such as a reporting financial institution or a holding or other parent company filling for its subsidiaries.',
  'ui:schema': {
    'ui:group': 'Parent Financial Institution Information',
  },
  properties: {
    InstitutionName: {
      ...pickEntityFields(
        // Legal Name
        'PartyNameType',
        ['RawPartyFullName'],
        ['RawPartyFullName']
      ),
      title: 'Institution Legal Name',
      description:
        'Enter the full legal name of the parent financial institution.',
    },
    Address: pickEntityFields(
      'AddressType',
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
    InstituionTin: {
      // SSN or EIN
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        {
          PartyIdentificationTypeCode: pickPartyIdentificationTypeCodeSubset([
            '1',
            '2',
          ]),
        }
      ),
      title: 'Institution TIN',
      description:
        'Enter the parent financial institution’s EIN. If the financial institution does not have an EIN, enter the SSN of the institution’s principal owner. Do not enter hyphens, slashes, alpha characters, or invalid entries such as all nines, all zeros, or“123456789”',
    },
    TransmitterControlCode: {
      // TCC
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Transmitter Control Code (TCC)',
    },
    UserNotes: {
      ...UserNotes,
      title: 'Notes on institution',
    },
  },
  required: [
    'InstitutionName',
    'Address',
    'InstituionTin',
    'TransmitterControlCode',
  ],
}

export const ContactOffice = {
  type: 'object',
  title: 'Contact for Assistance',
  description:
    'This is the administrative office that should be contacted to obtain additional information about the FinCEN SAR.',
  'ui:schema': {
    'ui:group': 'Contact for Assistance Information',
  },
  properties: {
    ContactOfficeName: {
      ...pickEntityFields(
        'PartyNameType',
        ['RawPartyFullName'],
        ['RawPartyFullName']
      ),
      title: 'Administrative officer name',
      description:
        'This is the administrative office that should be contacted to obtain additional information about the FinCEN CTR.',
    },
    PhoneNumber: pickEntityFields(
      'PhoneNumberType',
      ['PhoneNumberExtensionText', 'PhoneNumberText'],
      ['PhoneNumberText']
    ),
  },
  required: ['ContactOfficeName', 'PhoneNumber'],
}

const InstituteTypeSubType = (
  pickResolvedEntityFields(
    'Party',
    ['OrganizationClassificationTypeSubtype'],
    ['OrganizationClassificationTypeSubtype'],
    {
      OrganizationClassificationTypeSubtype: {
        properties: {
          OrganizationTypeID: {
            title: 'Type of Financial Institution',
            description:
              'Enter the code that describes the financial institution. If "Other" is choosed, a brief description of the institution type must be entered in "Financial Institution Type Other" Description',
          },
          OtherOrganizationTypeText: {
            title: 'Type of Financial Institution Other',
            required: true,
            requiredWhen: { entity: 'OrganizationTypeID', values: ['1999'] },
          },
          OrganizationSubtypeID: {
            title: 'Gaming Institution Type',
            description:
              'If "Type of Financial Institution" is "Casino/Card club", enter the code that best describes the type of gaming institution. If the code "Other" is entered, enter a brief description in "Gaming Institution Type Other."',
            required: true,
            requiredWhen: { entity: 'OrganizationTypeID', values: ['1'] },
          },
          OtherOrganizationSubTypeText: {
            title: 'Gaming Institution Type Other',
            required: true,
            requiredWhen: { entity: 'OrganizationSubtypeID', values: ['999'] },
          },
        },
      },
    }
  )?.properties as any
).OrganizationClassificationTypeSubtype

export const TransactionLocation = {
  type: 'object',
  title: 'Financial Institution Where Transaction(s) Take Place',
  description:
    'This is the location (such as an office or ATM, for example) where the transaction(s) associated with the FinCEN CTR occurred',
  'ui:schema': {
    'ui:group': 'Financial Institution Location',
  },
  properties: {
    LocationCode: {
      // need to fix this for xml schema
      maxLength: 10,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
      title: 'Location (Code)',
      description:
        'Enter an identifying number for the financial institution where the transaction(s) took place. A 10-digit unique identifier for the branch where the transaction occurred. If the code has fewer than 10 digits, add leading zeros ',
    },
    FederalRegulator: {
      ...pickResolvedEntityFields(
        'PartyIdentificationType',
        ['PrimaryRegulatorTypeCode', 'PartyIdentificationNumberText'],
        ['PrimaryRegulatorTypeCode', 'PartyIdentificationNumberText'],
        {
          PartyIdentificationTypeCode: {
            ...pickPartyIdentificationTypeCodeSubset([
              '9',
              '1',
              '2',
              '7',
              '3',
              '4',
              '6',
              '14',
            ]),
            description: 'Institution identification code',
          },
          PartyIdentificationNumberText: {
            description:
              'A 10-digit unique identifier for the branch where the transaction occurred. If the code has fewer than 10 digits, add leading zeros',
          },
        }
      ),
      title: 'Primary Federal Regulator (code)',
      description:
        "Enter the financial institution Primary Federal Regulator code for the federal regulator or BSA examiner with primary responsibility for enforcing the institution's Bank Secrecy Act compliance.",
    },
    LegalName: {
      ...pickEntityFields(
        // legal name
        'PartyNameType',
        ['RawPartyFullName'],
        ['RawPartyFullName']
      ),
      title: 'Institution legal name',
      description: 'Enter the financial institution legal name',
    },
    AlternateName: {
      ...pickEntityFields(
        // legal name
        'PartyNameType',
        ['PartyNameTypeCode', 'RawPartyFullName'],
        ['PartyNameTypeCode', 'RawPartyFullName'],
        {
          PartyNameTypeCode: pickPartyNameTypeCodeSubset(['AKA', 'DBA']),
        }
      ),
      title: 'Institution alternate name',
      description: 'Enter the financial institution alternate name',
    },
    EIN: {
      // EIN '2'
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Employer Identification Number (EIN)',
      description:
        'Enter the Employer Identification Number (EIN) of the financial institution. Must be the 9-digit number assigned to the financial institution by the IRS. Do not enter hyphens, slashes, alpha characters, or individual entries such as all nines, all zeros, or "123456789".',
    },
    Address: pickEntityFields(
      'AddressType',
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
    InstituteTypeSubType: {
      ...InstituteTypeSubType,
      title: 'Institution type/subtype',
    },
    FinancialInstitutionID: {
      ...pickResolvedEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        {
          PartyIdentificationTypeCode: {
            ...pickPartyIdentificationTypeCodeSubset([
              '10',
              '11',
              '12',
              '13',
              '14',
            ]),
            description: 'Institution identification code',
          },
          PartyIdentificationNumberText: {
            description:
              'A 10-digit unique identifier for the branch where the transaction occurred. If the code has fewer than 10 digits, add leading zeros',
          },
        }
      ),
      description:
        'Identify the type of identification for the financial institution by entering the appropriate code from the following list',
      title: 'Financial institution identification (CRD, IARD, etc.)',
    },
  },
  required: [
    'LocationCode',
    'FederalRegulator',
    'LegalName',
    'EIN',
    'Address',
    'InstituteTypeSubType',
  ],
}
// [
//         'ActivityPartyTypeCode',
//         'BirthDateUnknownIndicator',
//         'EFilingCoverageBeginningDateText',
//         'EFilingCoverageEndDateText',
//         'FemaleGenderIndicator',
//         'IndividualBirthDateText',
//         'IndividualEntityCashInAmountText',
//         'IndividualEntityCashOutAmountText',
//         'MaleGenderIndicator',
//         'MultipleTransactionsPersonsIndividualsIndicator',
//         'PartyAsEntityOrganizationIndicator',
//         'PrimaryRegulatorTypeCode',
//         'UnknownGenderIndicator',
//         'PartyName',
//         'Address',
//         'PhoneNumber',
//         'PartyIdentification',
//         'OrganizationClassificationTypeSubtype',
//         'PartyOccupationBusiness',
//         'ElectronicAddress',
//         'Account',
//       ],

export const PersonInvolvedInTransaction = {
  ...pickResolvedEntityFields(
    'Party',
    [
      'ActivityPartyTypeCode',
      'BirthDateUnknownIndicator',
      'IndividualBirthDateText',
      'IndividualEntityCashInAmountText',
      'IndividualEntityCashOutAmountText',
      'MultipleTransactionsPersonsIndividualsIndicator',
      'PartyAsEntityOrganizationIndicator',
      'PrimaryRegulatorTypeCode',
      'PartyName',
      'Address',
      'PhoneNumber',
      'PartyIdentification',
      'PartyOccupationBusiness',
      'ElectronicAddress',
      'Account',
    ],
    [
      'ActivityPartyTypeCode',
      'IndividualBirthDateText',
      'IndividualEntityCashInAmountText',
      'IndividualEntityCashOutAmountText',
      'PrimaryRegulatorTypeCode',
      'PartyName',
      'Address',
      'PhoneNumber',
      'PartyIdentification',
      'PartyOccupationBusiness',
      'ElectronicAddress',
      'Account',
      'Gender',
    ],
    {
      ActivityPartyTypeCode: {
        ...pickActivityPartyTypeCodeSubset(['50', '17', '23', '58']),
        title: 'Person Involved Type',
      },
      BirthDateUnknownIndicator: {},
      IndividualBirthDateText: {},
      IndividualEntityCashInAmountText: {},
      IndividualEntityCashOutAmountText: {},
      MultipleTransactionsPersonsIndividualsIndicator: {},
      PartyAsEntityOrganizationIndicator: {
        required: true,
        requiredWhen: {
          entity: 'PersonInvolvedType',
          values: ['23', '58'],
        },
      },
      PrimaryRegulatorTypeCode: {},
      PartyName: {},
      Gender: {
        type: 'string',
        'ui:schema': {
          'ui:subtype': 'FINCEN_GENDER',
          'ui:maleIndicatorField': 'FemaleGenderIndicator',
          'ui:femaleIndicatorField': 'MaleGenderIndicator',
          'ui:unknownIndicatorField': 'UnknownGenderIndicator',
        },
      },
      Address: {},
      PhoneNumber: {
        title: 'Phone Number',
      },
      ElectronicAddress: {
        'ui:schema': {
          'ui:subtype': 'FINCEN_PHONE_NUMBER',
        },
      },
      PartyIdentification: {},
      PartyOccupationBusiness: {},
      Account: {
        oneOf: null,
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
  title: 'Person Involved in the Transaction',
  description:
    'This is the person (individual or entity) involved in the transaction(s) associated with the FinCEN CTR',
  'ui:schema': {
    'ui:group': 'Person Involved In Transaction',
  },
}

// TODO: need ui to render optional fields in forms

export const CurrencyTransactionActivity = {
  ...pickResolvedEntityFields(
    'CurrencyTransactionActivityType',
    [
      'AggregateTransactionIndicator',
      'ArmoredCarServiceIndicator',
      'ATMIndicator',
      'MailDepositShipmentIndicator',
      'NightDepositIndicator',
      'SharedBranchingIndicator',
      'TotalCashInReceiveAmountText',
      'TotalCashOutAmountText',
      'TransactionDateText',
    ],
    []
  ),
  title: 'Currency Transaction Activity',
  description:
    'Activity total amount and type (header). This is the container for information about the amount and type of transaction(s) associated with the FinCEN CTR activity',
  'ui:schema': {
    'ui:group': 'Currency transaction activity information',
  },
}

export const TransactionLocations = {
  type: 'array',
  title: 'Transaction locations',
  description:
    'These are the location (such as an office or ATM, for example) where the transaction(s) associated with the FinCEN CTR occurred',
  items: TransactionLocation,
  'ui:schema': {
    'ui:group': 'Transaction Locations',
  },
}

export const PersonsInvolvedInTransactions = {
  type: 'array',
  title: 'Persons Involved In Transactions',
  description:
    'These are the persons (individual or entity) involved in the transactions associated with the FinCEN CTR',
  'ui:schema': {
    'ui:group': 'Person involved in transaction',
  },
  items: PersonInvolvedInTransaction,
}
