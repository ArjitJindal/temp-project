import cloneDeep from 'lodash/cloneDeep'
import merge from 'lodash/merge'
import omit from 'lodash/omit'
import pick from 'lodash/pick'
import { FintracJsonSchemaResolved } from './resources/STRBatchSchema_Resolved'
import {
  ActivitySectorCode as ActivitySectorCodeEnum,
  SuspicionTypeCode as SuspicionTypeCodeEnum,
  MinisterialDirectiveCode as MinisterialDirectiveCodeEnum,
  PublicPrivatePartnershipProjectNameCode as PublicPrivatePartnershipProjectNameCodeEnum,
  IdentifierTypeCode as IdentifierTypeCodeEnum,
  CountryOfResidenceCode as CountryOfResidenceCodeEnum,
  ProvinceStateCode as ProvinceStateCodeEnum,
  IncorporationRegistrationTypeCode as IncorporationRegistrationTypeCodeEnum,
  StructureTypeCode as StructureTypeCodeEnum,
  MethodCode,
  AccountType,
  CurrencyCode,
  VirtualCurrencyCode,
  DefinitionType12,
  TransactionDirection,
  AccountStatusAtTimeOfTransaction,
  DefinitionType56,
  DeviceType,
  RelationshipOfConductorCode,
  DispositionCode,
  DefinitionType34,
} from './scripts/helper'

function pickResolvedEntityFields(
  isProperty: boolean,
  entityName: string,
  fields: string[],
  requiredFields: string[],
  overrides: object = {}
) {
  try {
    const entityType = isProperty ? 'properties' : 'definitions'
    const entity = FintracJsonSchemaResolved[entityType][entityName]
    let properties: Record<string, any> = entity.properties
      ? FintracJsonSchemaResolved[entityType][entityName].properties
      : {}

    FintracJsonSchemaResolved[entityType][entityName].allOf?.forEach(
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

        if (overrideValue.properties) {
          merged.properties = merged.properties || {}

          const mergedProperties: Record<string, any> = {}
          for (const [innerKey, innerOverride] of Object.entries(
            overrideValue.properties
          )) {
            const existing = merged.properties[innerKey] || {}
            mergedProperties[innerKey] = merge({}, existing, innerOverride)
          }

          const remainingInner = omit(
            merged.properties,
            Object.keys(overrideValue.properties)
          )
          Object.assign(mergedProperties, remainingInner)

          merged.properties = mergedProperties
        }

        result[key] = merge({}, merged, omit(overrideValue, ['properties']))
      } else {
        result[key] = overrideValue
      }
    }

    // Append remaining picked fields (not in overrides)
    const remaining = omit(picked, Object.keys(overrides))
    Object.assign(result, remaining)
    return {
      ...entity,
      properties: result,
      required: requiredFields,
    }
  } catch (e) {
    console.error(entityName, e)
  }
}

const ActivitySectorCode = {
  ...(
    pickResolvedEntityFields(true, 'reportDetails', ['activitySectorCode'], [])
      ?.properties as any
  ).activitySectorCode,
  ...ActivitySectorCodeEnum,
}

const MinisterialDirectiveCode = {
  ...(
    pickResolvedEntityFields(
      true,
      'reportDetails',
      ['ministerialDirectiveCode'],
      []
    )?.properties as any
  ).ministerialDirectiveCode,
  ...MinisterialDirectiveCodeEnum,
}

// manually add reportTypeCode and submitTypeCode
export const ReprotDetails = {
  ...pickResolvedEntityFields(
    true,
    'reportDetails',
    [
      'activitySectorCode',
      'reportingEntityNumber',
      'submittingReportingEntityNumber',
      'reportingEntityReportReference',
      'reportingEntityContactId',
      'ministerialDirectiveCode',
    ],
    [
      'reportingEntityNumber',
      'submittingReportingEntityNumber',
      'reportingEntityReportReference',
      'reportingEntityContactId',
    ],
    {
      activitySectorCode: ActivitySectorCode,
      reportingEntityNumber: {
        type: 'string',
        pattern: '^[0-9]{1,7}$',
      },
      submittingReportingEntityNumber: {
        type: 'string',
        pattern: '^[0-9]{1,7}$',
      },
      reportingEntityReportReference: {},
      reportingEntityContactId: {},
      ministerialDirectiveCode: MinisterialDirectiveCode,
    }
  ),
  'ui:schema': {
    'ui:group': 'Report details',
  },
  title: 'Report Details',
}

const PublicPrivatePartnershipProjectNameCode = {
  ...(
    pickResolvedEntityFields(
      true,
      'detailsOfSuspicion',
      ['suspicionTypeCode'],
      []
    )?.properties as any
  ).suspicionTypeCode,
  ...PublicPrivatePartnershipProjectNameCodeEnum,
}

// should see for the length of descriptionOfSuspiciousActivity
export const DetailsOfSuspicion = {
  ...pickResolvedEntityFields(
    true,
    'detailsOfSuspicion',
    [
      'descriptionOfSuspiciousActivity',
      'suspicionTypeCode',
      'publicPrivatePartnershipProjectNameCodes',
      'politicallyExposedPersonIncludedIndicator',
    ],
    ['publicPrivatePartnershipProjectNameCodes'],
    {
      descriptionOfSuspiciousActivity: {
        maxLength: 1000,
      },
      suspicionTypeCode: {
        ...SuspicionTypeCodeEnum,
        title: 'Suspicion Type (Code)',
      },
      publicPrivatePartnershipProjectNameCodes: {
        items: PublicPrivatePartnershipProjectNameCode,
      },
      politicallyExposedPersonIncludedIndicator: {},
    }
  ),
  'ui:schema': {
    'ui:group': 'Details of suspicion',
  },
  title: 'Details of Suspicion',
}

const ExternalTransactionReference = {
  ...pickResolvedEntityFields(false, 'externalTransactionReference', [], []),
  title: 'Transaction Reference',
}

export const RelatedReport = {
  type: 'object',
  title: 'Related Report',
  properties: {
    reportingEntityReportReference: {
      ...pickResolvedEntityFields(false, 'externalReportReference', [], []),
      title: 'Reporting Entity Report Reference',
    },
    reportingEntityTransactionReferences: {
      type: 'string',
      title: 'Reporting Entity Transaction Reference',
      items: ExternalTransactionReference,
    },
  },
  'ui:schema': {
    'ui:group': 'Related Reprot',
  },
}

export const RelatedReports = {
  type: 'array',
  items: RelatedReport,
  'ui:schema': {
    'ui:group': 'Related Reprots',
  },
  title: 'Related Reports',
}

export const ActionTaken = {
  ...pickResolvedEntityFields(
    true,
    'actionTaken',
    ['description'],
    ['description']
  ),
  'ui:schema': {
    'ui:group': 'Action taken',
  },
  title: 'Action Taken',
}

const CountryOfResidenceCode = {
  minLength: 2,
  maxLength: 2,
  'ui:schema': {
    'ui:subtype': 'COUNTRY',
  },
  ...CountryOfResidenceCodeEnum,
}

const ProvinceStateCode = {
  minLength: 2,
  maxLength: 2,
  'ui:schema': {
    'ui:subtype': 'COUNTRY_REGION',
    'ui:countryField': 'RawCountryCodeText',
  },
  ...ProvinceStateCodeEnum,
}

export const PersonName = pickResolvedEntityFields(
  false,
  'personName',
  ['givenName', 'surname', 'otherNameInitial'],
  [],
  {
    givenName: {
      title: 'Given Name',
    },
    surname: {
      title: 'Surname',
    },
    otherNameInitial: {
      title: 'Other Name Initial',
    },
  }
)

export const EntityName = pickResolvedEntityFields(
  false,
  'entityName',
  ['refId', 'nameOfEntity'],
  ['refId'],
  {
    refId: { title: 'Ref Id' },
    nameOfEntity: { title: 'Name of Entity' },
  }
)

const Identification = pickResolvedEntityFields(
  false,
  'identification',
  [
    'identifierTypeOther',
    'number',
    'jurisdictionOfIssueCountryCode',
    'jurisdictionOfIssueProvinceStateCode',
    'jurisdictionOfIssueProvinceStateName',
  ],
  [],
  {
    identifierTypeCode: { ...IdentifierTypeCodeEnum, title: 'Type (Code)' },
    identifierTypeOther: { title: 'Type Other' },
    number: { title: 'Number' },
    jurisdictionOfIssueCountryCode: {
      ...CountryOfResidenceCode,
      title: 'Jurisdiction of Issue Country (Code)',
    },
    jurisdictionOfIssueProvinceStateCode: {
      ...ProvinceStateCode,
      title: 'Jurisdiction of Issue Province (Code)',
    },
    jurisdictionOfIssueProvinceStateName: {
      title: 'Jurisdiction of Issue Province State Name',
    },
  }
)

const Identifications = { title: 'Identifications', items: Identification }

const StructuredAddress = {
  ...pickResolvedEntityFields(
    false,
    'structuredAddress',
    [
      'unitNumber',
      'buildingNumber',
      'streetAddress',
      'city',
      'district',
      'provinceStateCode',
      'provinceStateName',
      'subProvinceSubLocality',
      'postalZipCode',
      'countryCode',
    ],
    [],
    {
      unitNumber: { title: 'Unit number' },
      buildingNumber: { title: 'Building number' },
      streetAddress: { title: 'Street address' },
      city: { title: 'City' },
      district: { title: 'District' },
      provinceStateCode: { ...ProvinceStateCode, title: 'Province (Code)' },
      provinceStateName: { title: 'Province state name' },
      subProvinceSubLocality: { title: 'Sub Province locaclity' },
      postalZipCode: { title: 'Zip code' },
      countryCode: {
        ...CountryOfResidenceCodeEnum,
        title: 'Country (Code)',
      },
    }
  ),
  title: 'Structured Address',
}

const UnstructuredAddress = {
  ...pickResolvedEntityFields(
    false,
    'unstructuredAddress',
    ['countryCode', 'unstructured'],
    [],
    {
      countryCode: { ...CountryOfResidenceCodeEnum, title: 'Country (Code)' },
      unstructured: { title: 'Address' },
    }
  ),
  title: 'UnStructured Address',
}

const Address = {
  oneOf: [{ ...StructuredAddress }, { ...UnstructuredAddress }],
  showOneOfInCollapse: true,
  title: 'Address',
}

export const PersonDetail = pickResolvedEntityFields(
  false,
  'personDetails',
  [
    'refId',
    'surname',
    'givenName',
    'otherNameInitial',
    'alias',
    'telephoneNumber',
    'extensionNumber',
    'dateOfBirth',
    'countryOfResidenceCode',
    'occupation',
    'nameOfEmployer',
    'identifications',
  ],
  ['refId', 'identifications'],
  {
    refId: {
      title: 'Ref Id',
    },
    surname: {
      title: 'Surname',
    },
    givenName: {
      title: 'Given Name',
    },
    otherNameInitial: {
      title: 'Other Name Initial',
    },
    alias: {
      title: 'Alias',
    },
    address: Address,
    telephoneNumber: {
      title: 'Telephone',
    },
    extensionNumber: {
      title: 'Extension',
    },
    dateOfBirth: {
      title: 'Date of Birth',
    },
    countryOfResidenceCode: {
      ...CountryOfResidenceCode,
      title: 'Country of Residence (Code)',
    },
    occupation: {
      title: 'Occupation',
    },
    nameOfEmployer: {
      title: 'Name of employer',
    },
    identifications: Identifications,
  }
)

export const RegistrationsIncorporation = pickResolvedEntityFields(
  false,
  'registrationIncorporation',
  [
    'number',
    'jurisdictionOfIssueCountryCode',
    'jurisdictionOfIssueProvinceStateCode',
    'jurisdictionOfIssueProvinceStateName',
  ],
  [],
  {
    typeCode: {
      ...IncorporationRegistrationTypeCodeEnum,
      title: 'Incorporation Registration Type (Code)',
    },
    number: { title: 'Number' },
    jurisdictionOfIssueCountryCode: {
      ...CountryOfResidenceCode,
      title: 'Jurisdiction of issue (country)',
    },
    jurisdictionOfIssueProvinceStateCode: {
      ...ProvinceStateCode,
      title: 'Jurisdiction of issue (province or state)',
    },
    jurisdictionOfIssueProvinceStateName: {
      title: 'Jurisdiction of issue (province or state) name',
    },
  }
)

const authorizedPerson = pickResolvedEntityFields(
  false,
  'authorizedPerson',
  ['surname', 'givenName', 'otherNameInitial'],
  [],
  {
    surname: { title: 'Surname' },
    givenName: { title: 'Given name' },
    otherNameInitial: { title: 'Other name initial' },
  }
)

export const EntityDetail = pickResolvedEntityFields(
  false,
  'entityDetails',
  [
    'refId',
    'nameOfEntity',
    'address',
    'telephoneNumber',
    'extensionNumber',
    'natureOfPrincipalBusiness',
    'registrationIncorporationIndicator',
    'registrationsIncorporations',
    'identifications',
    'authorizedPersons',
  ],
  [
    'refId',
    'registrationsIncorporations',
    'identifications',
    'authorizedPersons',
  ],
  {
    refId: { title: 'Ref id' },
    nameOfEntity: { title: 'Name of Entity' },
    address: Address,
    telephoneNumber: { title: 'Telephone Number' },
    extensionNumber: { title: 'Extentsion Number' },
    natureOfPrincipalBusiness: { title: 'Nature of Principal Business' },
    registrationIncorporationIndicator: {
      title: 'Registration Incorporation (Indicator)',
    },
    registrationsIncorporations: {
      title: 'Registrations Incorporations',
      items: RegistrationsIncorporation,
    },
    identifications: Identifications,
    authorizedPersons: {
      title: 'Authorized Persons',
      items: authorizedPerson,
    },
  }
)

const employerInformation = {
  type: 'object',
  title: 'Employer Information',
  properties: {
    name: {
      type: 'string',
      minLength: 0,
      maxLength: 100,
      title: 'Name',
    },
    adddress: Address,
    telephoneNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 20,
      title: 'Telephone Number',
    },
    extensionNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 10,
      title: 'Extension Number',
    },
  },
}

export const PersonAndEmployerDetail = pickResolvedEntityFields(
  false,
  'personAndEmployerDetails',
  [
    'refId',
    'surname',
    'givenName',
    'otherNameInitial',
    'alias',
    'address',
    'telephoneNumber',
    'extensionNumber',
    'dateOfBirth',
    'countryOfResidenceCode',
    'countryOfCitizenshipCode',
    'occupation',
    'identifications',
  ],
  ['refId', 'identifications'],
  {
    refId: { title: 'Ref Id' },
    surname: { title: 'Surname' },
    givenName: { title: 'Given name' },
    otherNameInitial: { title: 'Other name initial' },
    alias: { title: 'Alias' },
    address: Address,
    telephoneNumber: { title: 'Telephone Number' },
    extensionNumber: { title: 'Extentsion Number' },
    dateOfBirth: { title: 'Date of Birth' },
    countryOfResidenceCode: {
      ...CountryOfResidenceCode,
      title: 'Country of Residence (Code)',
    },
    countryOfCitizenshipCode: {
      ...CountryOfResidenceCode,
      title: 'Country of Citizenship (Code)',
    },
    occupation: { title: 'Occupation' },
    employerInformation: employerInformation,
    identifications: Identifications,
  }
)

const PersonContact = pickResolvedEntityFields(
  false,
  'personContact',
  [
    'surname',
    'givenName',
    'otherNameInitial',
    'address',
    'telephoneNumber',
    'extensionNumber',
  ],
  [],
  {
    surname: { title: 'Surname' },
    givenName: { title: 'Given name' },
    otherNameInitial: { title: 'Other name initial' },
    address: Address,
    telephoneNumber: { title: 'Telephone Number' },
    extensionNumber: { title: 'Extentsion Number' },
  }
)

export const EntityAndBeneficialOwnershipDetail = pickResolvedEntityFields(
  false,
  'entityAndBeneficialOwnershipDetails',
  [
    'refId',
    'nameOfEntity',
    'address',
    'telephoneNumber',
    'extensionNumber',
    'identifications',
    'authorizedPersons',
    'structureTypeOther',
    'natureOfPrincipalBusiness',
    'registrationIncorporationIndicator',
    'registrationsIncorporations',
    'directorsOfCorporation',
    'personsOwningSharesOfCorporation',
    'trusteesOfTrust',
    'settlorsOfTrust',
    'personsOwningUnitsOfTrust',
    'beneficiariesOfTrust',
    'personsOwningEntityNotCorporationOrTrust',
  ],
  [
    'refId',
    'identifications',
    'authorizedPersons',
    'registrationsIncorporations',
    'directorsOfCorporation',
    'personsOwningSharesOfCorporation',
    'trusteesOfTrust',
    'settlorsOfTrust',
    'personsOwningUnitsOfTrust',
    'beneficiariesOfTrust',
    'personsOwningEntityNotCorporationOrTrust',
  ],
  {
    refId: { title: 'Ref Id' },
    nameOfEntity: { title: 'Name of Entity' },
    address: Address,
    telephoneNumber: { title: 'Telephone Number' },
    extensionNumber: { title: 'Extentsion Number' },
    identifications: Identifications,
    authorizedPersons: {
      title: 'Authorized Persons',
      items: authorizedPerson,
    },
    structureTypeCode: {
      ...StructureTypeCodeEnum,
      title: 'Structure Type (Code)',
    },
    structureTypeOther: {
      title: 'Structure Type (Other)',
    },
    natureOfPrincipalBusiness: {
      title: 'Nature of Principal Business',
    },
    registrationIncorporationIndicator: {
      title: 'Registration Incorporation (Indicator)',
    },
    registrationsIncorporations: {
      title: 'Registrations Incorporations',
      items: RegistrationsIncorporation,
    },
    directorsOfCorporation: {
      items: PersonContact,
      title: 'Directors of Corporation',
    },
    personsOwningSharesOfCorporation: {
      items: PersonName,
      title: 'Persons Owning Shares Of Corporation',
    },
    trusteesOfTrust: {
      items: PersonContact,
      title: 'Person Contact',
    },
    settlorsOfTrust: {
      items: PersonContact,
      title: 'Settlors Of Trust',
    },
    personsOwningUnitsOfTrust: {
      items: PersonContact,
      title: 'Persons Owning Units Of Trust',
    },
    beneficiariesOfTrust: {
      items: PersonContact,
      title: 'Beneficiaries Of Trust',
    },
    personsOwningEntityNotCorporationOrTrust: {
      items: PersonName,
      title: 'Persons Owning Entity Not Corporation Or Trust',
    },
  }
)

const Account = pickResolvedEntityFields(
  false,
  'account',
  [
    'financialInstitutionNumber',
    'branchNumber',
    'number',
    'typeCode',
    'typeOther',
    'currencyCode',
    'virtualCurrencyTypeCode',
    'virtualCurrencyTypeOther',
    'dateOpened',
    'dateClosed',
    'holders',
  ],
  ['holders'],
  {
    financialInstitutionNumber: { title: 'Financial Institution Number' },
    branchNumber: { title: 'Branch Number' },
    number: { title: 'Number' },
    typeCode: { title: 'Account type', ...AccountType },
    typeOther: { title: 'Account type (other)' },
    currencyCode: { title: 'Currency (Code)', ...CurrencyCode },
    virtualCurrencyTypeCode: {
      title: 'Virtual currency (Code)',
      ...VirtualCurrencyCode,
    },
    virtualCurrencyTypeOther: { title: 'Virtual currency (Other)' },
    dateOpened: { title: 'Date opened' },
    dateClosed: { title: 'Date closed' },
    holders: {
      items: {
        properties: {
          typeCode: {
            title: 'Holder (Type)',
            ...DefinitionType12,
          },
          refId: {
            title: 'Ref Id',
            type: 'string',
            pattern: '^[A-Za-z0-9-_]{1,50}$',
          },
        },
        required: ['typeCode', 'refId'],
      },
    },
  }
)

const StartingActionDetails = {
  type: 'object',
  title: 'Starting Action Details',
  properties: {
    direction: {
      title: 'Transaction direction',
      ...TransactionDirection,
    },
    fundAssetVirtualCurrencyTypeCode: {
      title: 'Fund Asset Virtual Currency (Code)',
      ...VirtualCurrencyCode,
    },
    fundAssetVirtualCurrencyTypeOther: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Fund Asset Virtual Currency (Other)',
    },
    amount: {
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
      title: 'Amount',
    },
    currencyCode: {
      title: 'Currency (Code)',
      ...CurrencyCode,
    },
    virtualCurrencyTypeCode: {
      title: 'Virtual Currency (Code)',
      ...VirtualCurrencyCode,
    },
    virtualCurrencyTypeOther: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Virtual Currency (Other)',
    },
    exchangeRate: {
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
      title: 'Exchange Rate',
    },
    virtualCurrencyTransactionIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Transaction id',
      },
      title: 'Transaction Ids',
    },
    sendingVirtualCurrencyAddresses: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Sending Virtual Currency Address',
      },
      title: 'Sending Virtual Currency Addresses',
    },
    receivingVirtualCurrencyAddresses: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Receiving Virtual Currency Address',
      },
      title: 'Receiving Virtual Currency Addresses',
    },
    referenceNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Reference Number',
    },
    referenceNumberOtherRelatedNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Reference Number (Other)',
    },
    account: {
      ...Account,
      title: 'Account',
    },
    accountStatusAtTimeOfTransaction: {
      ...AccountStatusAtTimeOfTransaction,
      title: 'Account Status at Time of Transaction',
    },
    howFundsOrVirtualCurrencyObtained: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'How Funds or Virtual Currency Obtained',
    },
    sourcesOfFundsOrVirtualCurrencyIndicator: {
      type: 'boolean',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
      title: 'Source of Funds Or Virtual Currency',
    },
    conductorIndicator: {
      type: 'boolean',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
      title: 'Couductor',
    },
  },
  required: [
    'virtualCurrencyTransactionIds',
    'receivingVirtualCurrencyAddresses',
    'sendingVirtualCurrencyAddresses',
  ],
}

const StartingActionSourcesOfFundsOrVirtualCurrency = {
  type: 'array',
  title: 'Source Of Funds or Virtual Currency(ies)',
  required: ['typeCode', 'refId'],
  items: {
    type: 'object',
    title: 'Source Of Funds or Virtual Currency',
    properties: {
      typeCode: {
        title: 'Source of Funds Type (Code)',
        ...DefinitionType12,
      },
      refId: {
        type: 'string',
        pattern: '^[A-Za-z0-9-_]{1,50}$',
        title: 'Ref Id',
      },
      details: {
        type: 'object',
        title: 'Details',
        properties: {
          accountNumber: {
            type: 'string',
            minLength: 0,
            maxLength: 100,
            title: 'Account Number',
          },
          policyNumber: {
            type: 'string',
            minLength: 0,
            maxLength: 100,
            title: 'Policy Number',
          },
          identifyingNumber: {
            type: 'string',
            minLength: 0,
            maxLength: 100,
            title: 'Identifying Number',
          },
        },
      },
    },
  },
}

const StartingActionConductors = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      typeCode: {
        title: 'Counductor Type (Code)',
        ...DefinitionType56,
      },
      refId: {
        title: 'Ref Id',
        type: 'string',
        pattern: '^[A-Za-z0-9-_]{1,50}$',
      },
      details: {
        type: 'object',
        title: 'Conductor Details',
        properties: {
          clientNumber: {
            title: 'Client Number',
            type: 'string',
            minLength: 0,
            maxLength: 100,
          },
          emailAddress: {
            title: 'Email Address',
            type: 'string',
            minLength: 0,
            maxLength: 200,
            'ui:schema': {
              'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
              'ui:value': 'EMAIL',
            },
          },
          url: {
            title: 'Url',
            type: 'string',
            minLength: 0,
            maxLength: 200,
            'ui:schema': {
              'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
              'ui:value': 'URL',
            },
          },
          typeOfDeviceCode: {
            title: 'Device Type (Code)',
            ...DeviceType,
          },
          typeOfDeviceOther: {
            title: 'Type of Device Other',
            type: 'string',
            minLength: 0,
            maxLength: 200,
          },
          username: {
            username: 'Username',
            type: 'string',
            minLength: 0,
            maxLength: 100,
          },
          deviceIdentifierNumber: {
            title: 'Device Identifier Number',
            type: 'string',
            minLength: 0,
            maxLength: 200,
          },
          internetProtocolAddress: {
            title: 'Ip Address',
            type: 'string',
            minLength: 0,
            maxLength: 200,
          },
          dateTimeOfOnlineSession: {
            title: 'Date-Time of Online Session',
            type: 'string',
            pattern:
              '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
          },
          onBehalfOfIndicator: {
            title: 'On Behalf (Indicator)',
            type: 'boolean',
            'ui:schema': {
              'ui:subtype': 'FINCEN_INDICATOR',
            },
          },
        },
      },
      onBehalfOfs: {
        type: 'array',
        title: 'On Behalf Ofs',
        items: {
          type: 'object',
          title: 'On Behalf of',
          properties: {
            typeCode: {
              title: 'On Behalf Type (Code)',
              ...DefinitionType56,
            },
            refId: {
              title: 'Ref Id',
              type: 'string',
              pattern: '^[A-Za-z0-9-_]{1,50}$',
            },
            details: {
              type: 'object',
              title: 'Details',
              properties: {
                clientNumber: {
                  title: 'Client Number',
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                emailAddress: {
                  title: 'Email Address',
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
                    'ui:value': 'EMAIL',
                  },
                },
                url: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
                    'ui:value': 'URL',
                  },
                },
                relationshipOfConductorCode: {
                  ...RelationshipOfConductorCode,
                  title: 'Relationship of Conductor (Code)',
                },
                relationshipOfConductorOther: {
                  title: 'Relationship of Conductor (Other)',
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
              },
            },
          },
          required: ['typeCode', 'refId'],
        },
      },
    },
    required: ['typeCode', 'refId', 'details', 'onBehalfOfs'],
  },
}

const CompletingActionsDetails = {
  type: 'object',
  title: 'Completing Actions Details',
  required: [
    'virtualCurrencyTransactionIds',
    'receivingVirtualCurrencyAddresses',
    'sendingVirtualCurrencyAddresses',
  ],
  properties: {
    dispositionCode: {
      title: 'Disposition Type (Code)',
      ...DispositionCode,
    },
    dispositionOther: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Disposition Type (Other)',
    },
    amount: {
      title: 'Amount',
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
    },
    currencyCode: {
      title: 'Currency (Code)',
      ...CurrencyCode,
    },
    virtualCurrencyTypeCode: {
      title: 'Virtual Currency Type (Code)',
      ...VirtualCurrencyCode,
    },
    virtualCurrencyTypeOther: {
      title: 'Virtual Currency Type (Other)',
      type: 'string',
      minLength: 0,
      maxLength: 200,
    },
    exchangeRate: {
      title: 'Exchange Rate',
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
    },
    valueInCanadianDollars: {
      title: 'ValueIn Canadian Dollars',
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
    },
    virtualCurrencyTransactionIds: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Transaction id',
      },
      title: 'Transaction Ids',
    },
    sendingVirtualCurrencyAddresses: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Sending Virtual Currency Address',
      },
      title: 'Sending Virtual Currency Addresses',
    },
    receivingVirtualCurrencyAddresses: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 0,
        maxLength: 200,
        title: 'Receiving Virtual Currency Address',
      },
      title: 'Receiving Virtual Currency Addresses',
    },
    referenceNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Reference Number',
    },
    referenceNumberOtherRelatedNumber: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
      title: 'Reference Number (Other)',
    },
    account: {
      ...Account,
      title: 'Account',
    },
    accountStatusAtTimeOfTransaction: {
      ...AccountStatusAtTimeOfTransaction,
      title: 'Account Action at time of Transaction',
    },
    involvementIndicator: {
      type: 'boolean',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
      title: 'Involvement Indicator',
    },
    beneficiaryIndicator: {
      type: 'boolean',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
      title: 'Beneficiary Indicator',
    },
  },
}

const Beneficiaries = {
  type: 'array',
  title: 'Beneficiaries',
  items: {
    type: 'object',
    properties: {
      typeCode: {
        title: 'Beneficiary Type (Code)',
        ...DefinitionType34,
      },
      refId: {
        title: 'Ref Id',
        type: 'string',
        pattern: '^[A-Za-z0-9-_]{1,50}$',
      },
      details: {
        type: 'object',
        title: 'Beneficiary Details',
        properties: {
          clientNumber: {
            title: 'Client Number',
            type: 'string',
            minLength: 0,
            maxLength: 100,
          },
          username: {
            username: 'Username',
            type: 'string',
            minLength: 0,
            maxLength: 100,
          },
          emailAddress: {
            title: 'Email Address',
            type: 'string',
            minLength: 0,
            maxLength: 200,
            'ui:schema': {
              'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
              'ui:value': 'EMAIL',
            },
          },
        },
      },
    },
    required: ['typeCode', 'refId'],
  },
}

const SuspiciousTransactionDetail = {
  type: 'object',
  title: 'Suspicious Transaction Details',
  properties: {
    attemptedTransactionIndicator: {
      title: 'Attempted Transaction (Indicator)',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
      type: 'boolean',
    },
    reasonNotCompleted: {
      title: 'Reason not completed',
      type: 'string',
      minLength: 0,
      maxLength: 200,
    },
    dateOfTransaction: {
      title: 'Date of transaction',
      type: 'string',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    timeOfTransaction: {
      title: 'Time of transaction',
      type: 'string',
      pattern: '^[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
    },
    methodCode: {
      title: 'Method (Code)',
      ...MethodCode,
    },
    methodOther: {
      title: 'Method (Other)',
      type: 'string',
      minLength: 0,
      maxLength: 200,
    },
    dateOfPosting: {
      title: 'Date of posting',
      type: 'string',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    timeOfPosting: {
      title: 'Time of posting',
      type: 'string',
      pattern: '^[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
    },
    reportingEntityTransactionReference: {
      title: 'Reporting Entity Transaction Reference',
      type: 'string',
      pattern: '^[A-Za-z0-9-_]{1,200}$',
    },
    purpose: {
      title: 'Purpose',
      type: 'string',
      minLength: 0,
      maxLength: 200,
    },
  },
  required: ['attemptedTransactionIndicator'],
}

const StartingActions = {
  type: 'array',
  title: 'Starting Actions',
  items: {
    type: 'object',
    title: 'Starting Action',
    required: ['details', 'sourcesOfFundsOrVirtualCurrency', 'conductors'],
    properties: {
      StartingActionDetails,
      StartingActionSourcesOfFundsOrVirtualCurrency,
      StartingActionConductors,
    },
  },
}

const CompletingActions = {
  type: 'array',
  title: 'Completing Actions',
  items: {
    type: 'object',
    title: 'Completing Action',
    required: ['details', 'involvements', 'beneficiaries'],
    properties: {
      CompletingActionsDetails,
      Involvements: {
        ...StartingActionSourcesOfFundsOrVirtualCurrency,
        items: {
          ...StartingActionSourcesOfFundsOrVirtualCurrency.items,
          title: 'Involvement',
        },
        title: 'Indicators',
      },
      Beneficiaries,
    },
  },
}

export const PersonNames = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Person names',
  },
  items: {
    ...PersonName,
    properties: {
      refId: {
        title: 'Ref Id',
        type: 'string',
        pattern: '^[A-Za-z0-9-_]{1,50}$',
      },
      ...PersonName.properties,
    },
    required: ['refId'],
  },
  title: 'Person names',
}

export const EntityNames = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Entity names',
  },
  items: {
    ...EntityName,
    properties: {
      refId: {
        title: 'Ref Id',
        type: 'string',
        pattern: '^[A-Za-z0-9-_]{1,50}$',
      },
      ...EntityName.properties,
    },
    required: ['refId'],
  },
  title: 'Person names',
}

export const PersonDetails = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Person details',
  },
  items: PersonDetail,
  title: 'Person Details',
}

export const EntityDetails = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Entity details',
  },
  items: EntityDetail,
  title: 'Entity Details',
}

export const PersonAndEmployerDetails = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Person and Employer details',
  },
  items: PersonAndEmployerDetail,
  title: 'Person and Employer Details',
}

export const EntityAndBeneficialOwnershipDetails = {
  type: 'array',
  'ui:schema': {
    'ui:group': 'Entity and Beneficial Ownership details',
  },
  items: EntityAndBeneficialOwnershipDetail,
  title: 'Entity and Beneficial Ownership Details',
}

export const Transactions = {
  type: 'array',
  title: 'Transactions',
  'ui:schema': {
    'ui:group': 'Transactions',
  },
  required: [
    'reportingEntityLocationId',
    'suspiciousTransactionDetails',
    'startingActions',
    'completingActions',
  ],
  items: {
    type: 'object',
    title: 'Transaction',
    properties: {
      reportingEntityLocationId: {
        title: 'Reporting Entity Location Id',
        type: 'string',
        minLength: 0,
        maxLength: 30,
      },
      suspiciousTransactionDetails: SuspiciousTransactionDetail,
      startingActions: StartingActions,
      completingActions: CompletingActions,
    },
  },
}
