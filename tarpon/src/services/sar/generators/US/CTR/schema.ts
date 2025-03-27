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
    return {
      type: 'object',
      properties: result,
      required: requiredFields,
    }
  } catch (e) {
    console.error(entityName, e)
  }
}

const legalPartyName = pickEntityFields(
  'PartyNameType',
  ['RawPartyFullName'],
  ['RawPartyFullName']
)

const alternateParyName = pickEntityFields(
  'PartyNameType',
  ['PartyNameTypeCode', 'RawPartyFullName'],
  ['PartyNameTypeCode', 'RawPartyFullName'],
  {
    PartyNameTypeCode: pickPartyNameTypeCodeSubset(['AKA', 'DBA']),
  }
)

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

// 35 Transmitter
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
      ...legalPartyName,
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
      ['PhoneNumberText'],
      ['PhoneNumberText']
    ),
    TransmitterTin: {
      //4
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Transmitter TIN',
    },
  },
  required: [
    'TransmitterName',
    'TransmitterAddress',
    'TransmitterTelephoneNumber',
    'TransmitterTin',
  ],
}

// 37 = Transmitter Contact
export const TransmitterContact = {
  type: 'object',
  title: 'Transmitter contact',
  description: 'This is the official contact for the transmitter.',
  'ui:schema': {
    'ui:group': 'Transmitter contact information',
  },
  properties: {
    PartyName: {
      ...legalPartyName,
      title: 'Legal name',
    },
  },
  required: ['PartyName'],
}

// 30 = Filing institution
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
      ...legalPartyName,
      title: 'Institution Legal Name',
      description:
        'Enter the full legal name of the parent financial institution.',
    },
    InstitutionAlternateName: {
      ...alternateParyName,
      title: 'Alternate Institution name',
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
    InstituionEin: {
      //  EIN
      ...pickEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationNumberText'],
        ['PartyIdentificationNumberText']
      ),
      title: 'Institution EIN',
      description:
        "Enter the parent financial institution's EIN. Do not enter hyphens, slashes, alpha characters, or invalid entries such as all nines, all zeros, or '123456789'",
    },
    FinancialInstitutionIdentification: {
      ...pickResolvedEntityFields(
        'PartyIdentificationType',
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
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
            required: true,
            description: 'Institution identification code',
          },
          PartyIdentificationNumberText: {
            description:
              'A 10-digit unique identifier for the branch where the transaction occurred. If the code has fewer than 10 digits, add leading zeros',
          },
        }
      ),
      title: 'Financial Institution Identification (code)',
    },
    InstituteTypeSubType: {
      ...InstituteTypeSubType,
      title: 'Institution type/subtype',
    },
  },
  required: [
    'InstitutionName',
    'Address',
    'InstituionEin',
    'FinancialInstitutionIdentification',
    'InstituteTypeSubType',
  ],
}

// 8 = Contact for assistance
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
      ...legalPartyName,
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

// 34 = Transaction location
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
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
        ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
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
      ...legalPartyName,
      title: 'Institution legal name',
      description: 'Enter the financial institution legal name',
    },
    AlternateName: {
      ...pickEntityFields(
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
    'Address',
    'InstituteTypeSubType',
    'FinancialInstitutionID',
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

const legalNameForPersonInvolved = {
  type: 'object',
  properties: pick(
    (pickResolvedEntityFields('Party', ['PartyName'], [])?.properties as any)
      .PartyName.items.properties,
    [
      'RawEntityIndividualLastName',
      'RawIndividualFirstName',
      'RawIndividualMiddleName',
      'RawIndividualNameSuffixText',
    ]
  ),
}

const alternateNameForPersonInvolved = {
  type: 'object',
  properties: merge(
    pick(
      (pickResolvedEntityFields('Party', ['PartyName'], [])?.properties as any)
        .PartyName.items.properties,
      [
        'RawEntityIndividualLastName',
        'RawIndividualFirstName',
        'RawIndividualMiddleName',
        'RawIndividualNameSuffixText',
      ]
    ),
    {
      PartyNameTypeCode: {
        title: 'Party name type (code)',
        description:
          'This element identifies the type of name recorded for the party; specifically, legal name, doing business as (DBA) name, or also known as (AKA) name.',
        enum: ['AKA', 'DBA'],
        type: 'string',
        enumNames: ['Also known as (AKA)', 'Doing business as (DBA)'],
      },
    }
  ),
}

const addressForPersonInvolved = {
  type: 'object',
  properties: pick(
    (pickResolvedEntityFields('Party', ['Address'], [])?.properties as any)
      .Address.properties,
    [
      'RawCityText',
      'RawCountryCodeText',
      'RawStateCodeText',
      'RawStreetAddress1Text',
      'RawZIPCode',
    ]
  ),
}

const formOfIndentification = {
  type: 'object',
  properties: merge(
    pick(
      (
        pickResolvedEntityFields('Party', ['PartyIdentification'], [])
          ?.properties as any
      ).PartyIdentification.items.properties,
      [
        'PartyIdentificationTypeCode',
        'OtherIssuerCountryText',
        'OtherIssuerStateText',
        'OtherPartyIdentificationTypeText',
        'PartyIdentificationNumberText',
      ]
    ),
    {
      PartyIdentificationTypeCode: {
        ...pickPartyIdentificationTypeCodeSubset([
          '5', // Driver's License
          '6', // Passport
          '7', // Alien registration
          '8', // Other
        ]),
        title: 'Form of identification',
        description:
          'Select the form of identification used to verify the identity',
      },
    }
  ),
}

export const PersonInvolvedInTransaction = {
  ...pickResolvedEntityFields(
    'Party',
    [
      'IndividualBirthDateText',
      'IndividualEntityCashInAmountText',
      'IndividualEntityCashOutAmountText',
      'MultipleTransactionsPersonsIndividualsIndicator',
      'PhoneNumber',
      'PartyOccupationBusiness',
      'ElectronicAddress',
      'Account',
    ],
    [
      'PartyName',
      'IndividualEntityCashInAmountText',
      'IndividualEntityCashOutAmountText',
      'Account',
    ],
    {
      PartyName: {
        ...legalNameForPersonInvolved,
        title: 'Legal name of the person',
      },
      AlertnatePartyName: {
        ...alternateNameForPersonInvolved,
        title: 'Alternate name of the peson',
      },
      IndividualBirthDateText: {
        description: 'This element identifies the date of birth of the party.',
      },
      Gender: {
        type: 'string',
        'ui:schema': {
          'ui:subtype': 'FINCEN_GENDER',
          'ui:maleIndicatorField': 'FemaleGenderIndicator',
          'ui:femaleIndicatorField': 'MaleGenderIndicator',
          'ui:unknownIndicatorField': 'UnknownGenderIndicator',
        },
      },
      PhoneNumber: {
        title: 'Phone Number',
      },
      ElectronicAddress: {},
      Address: {
        ...addressForPersonInvolved,
        title: 'Address',
      },
      TIN: {
        ...pickResolvedEntityFields(
          'PartyIdentificationType',
          ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
          ['PartyIdentificationTypeCode', 'PartyIdentificationNumberText'],
          {
            PartyIdentificationTypeCode: {
              ...pickPartyIdentificationTypeCodeSubset(['1', '2', '9']),
              required: true,
              description: 'Identification code',
            },
            PartyIdentificationNumberText: {
              description:
                'A 10-digit unique identifier for the branch where the transaction occurred. If the code has fewer than 10 digits, add leading zeros',
            },
          }
        ),
        title: 'Tax Payer Indentification',
      },
      FormOfIdentification: {
        ...formOfIndentification,
        title: 'Form of identification',
      },
      PartyOccupationBusiness: {},
      IndividualEntityCashInAmountText: {
        title: 'Cash In',
        description:
          'Party cash in amount (text). This element identifies the cash in amount associated with the party',
      },
      IndividualEntityCashOutAmountText: {
        title: 'Cash out',
        decription:
          'Party cash out amount (text). This element identifies the cash out amount associated with the party.',
      },
      MultipleTransactionsPersonsIndividualsIndicator: {
        title: 'Multiple transactions (indicator).',
        description:
          'This element declares that multiple cash transactions of any amount totaling more than $10,000 as cash in or more than $10,000 as cash out (cash in and cash out transactions should not be combined) were conducted in a single business day by or for the person recorded in Part I.',
      },
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
    'CurrencyTransactionActivity',
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
      'CurrencyTransactionActivityDetail',
    ],
    [
      'TotalCashInReceiveAmountText',
      'TotalCashOutAmountText',
      'TransactionDateText',
      'CurrencyTransactionActivityDetail',
    ],
    {
      AggregateTransactionIndicator: {
        title: 'Aggregate transactions (indicator)',
        description:
          'This element declares that the financial institution did not identify any transactor(s) because the FinCEN CTR reports aggregated transactions all below the reporting requirement with at least one transaction involving a teller. "Aggregated transactions" is not the same as "Multiple transactions," which can involve transactions that are above the reporting requirement where a transactor is known and may involve transactions none of which involved a teller.',
      },
      ArmoredCarServiceIndicator: {
        title: 'Armored car (FI contract) (indicator)',
        description:
          'This element declares that a reported transaction involved a pick-up or delivery of currency by an armored car service under contract to the financial institution(s) where transactions take place (i.e. transaction location) or the filing institution.',
      },
      ATMIndicator: {
        title: 'ATM (indicator)',
        description:
          'This element declares that a reported transaction occurred at an automated teller machine (ATM).',
      },
      MailDepositShipmentIndicator: {
        title: 'Mail deposit or shipment (indicator)',
        description:
          'This element declares that a reported transaction was made by mail deposit or shipment.',
      },
      NightDepositIndicator: {
        title: 'Night deposit (indicator)',
        description:
          'This element declares that a reported transaction involved a night deposit of cash.',
      },
      SharedBranchingIndicator: {
        title: 'Shared branching (indicator)',
        description:
          'This element declares that the transaction was conducted on behalf of or at a location of another financial institution that is a member of a co-operative network.',
      },
      TotalCashInReceiveAmountText: {
        title: 'Total cash in amount (text)',
        description:
          'This element identifies the total cash in amount involved in the transaction(s) if that amount is greater than $10,000. NOTE: The amount can be less than or equal to $10,000 in a corrected CTR that is being filed to correct the amount reported in a previous CTR',
      },
      TotalCashOutAmountText: {
        title: 'Total cash out amount (text)',
        description:
          'This element identifies the total cash out amount involved in the transaction or aggregated transactions if that amount is greater than $10,000. NOTE: The amount can be less than or equal to $10,000 in a corrected CTR that is being filed to correct the amount reported in a previous CTR.',
      },
      TransactionDateText: {
        title: 'Transaction date (text)',
        description:
          'This element identifies the date in which the transaction(s) associated with the FinCEN CTR take place.',
      },
      CurrencyTransactionActivityDetail: {
        title: 'Activity subtotal amount and type (header)',
        description:
          'This is the container for cash-in/out amount details (including foreign cash transactions amounts) associated with the FinCEN CTR activity.',
        properties: {
          CurrencyTransactionActivityDetailTypeCode: {
            title: 'Currency Transaction Activity Detail Type (Code)',
          },
          DetailTransactionAmountText: {
            title: 'Detail Transaction Amount',
          },
          OtherCurrencyTransactionActivityDetailText: {
            title: 'Other Currency Transaction Activity Detail',
          },
          OtherForeignCurrencyCountryText: {
            title: 'Other Foreign Currency Country',
          },
        },
      },
    }
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

const PersonConductingTransactionOnOwnBehalf = {
  ...PersonInvolvedInTransaction,
  type: 'object',
  title: 'Person conducting transaction on own behalf',
  'ui:schema': {
    'ui:group': 'Person conducting transaction on own behalf',
  },
}

const PersonConductingTransactionForAnother = {
  ...PersonInvolvedInTransaction,
  type: 'object',
  title: 'Person conducting transaction for another',
  'ui:schema': {
    'ui:group': 'Person conducting transaction for another',
  },
}

const PersonOnWhoseBehalfThisTransactionWasConducted = {
  ...PersonInvolvedInTransaction,
  type: 'object',
  title: 'Person on whose behalf this transaction was conducted',
  'ui:schema': {
    'ui:group': 'Person on whose behalf this transaction was conducted',
  },
}

const CommonCarrier = {
  ...PersonInvolvedInTransaction,
  type: 'object',
  title: 'Common carrier',
  'ui:schema': {
    'ui:group': 'Common carrier',
  },
}

export const PersonsInvolvedInTransactions = {
  type: 'object',
  title: 'Persons Involved In Transactions',
  description:
    'These are the persons (individual or entity) involved in the transactions associated with the FinCEN CTR',
  'ui:schema': {
    'ui:group': 'Person involved in transaction',
  },
  properties: {
    PersonConductingTransactionOnOwnBehalf,
    PersonConductingTransactionForAnother,
    PersonOnWhoseBehalfThisTransactionWasConducted,
    CommonCarrier,
  },
}
