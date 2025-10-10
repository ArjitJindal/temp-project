export const FincenJsonSchema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Sun Mar 23 2025 16:44:10 GMT+0530 (India Standard Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    "Schema tag attributes: xmlns='www.fincen.gov/base' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:vc='http://www.w3.org/2007/XMLSchema-versioning' targetNamespace='www.fincen.gov/base' elementFormDefault='qualified' attributeFormDefault='unqualified' vc:minVersion='1.1'",
  properties: {
    EFilingBatchXML: {
      $ref: '#/definitions/EFilingBatchXML',
      title: 'Batch acknowledgement',
      description:
        'This is the container for the contents of the batch acknowledgement file.',
    },
  },
  type: 'object',
  definitions: {
    ActivityType: {
      required: ['FilingDateText'],
      properties: {
        EFilingPriorDocumentNumber: {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
          title: 'Prior report BSA Identifier (number)',
          description:
            'The BSA Identifier (BSA ID) of the previously-filed FinCEN SAR when filing a correction/amendment and/or a continuing activity report. The value provided must adhere to the following requirements: 14-digit numeric BSA ID (if known); 14 consecutive zeros, i.e. “00000000000000” (if the BSA ID is unknown).',
        },
        FilingDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
          title: 'Filing date',
          description:
            'The date in which the FinCEN SAR is being filed electronically through FinCEN’s BSA E-Filing System. The value provided must adhere to the following requirements: 8 numeric characters in the format YYYYMMDD where YYYY = year, MM = month, and DD = day. Single digit days or months must be prefaced by a zero',
        },
      },
      type: 'object',
    },
    ActivityAssociationType: {
      required: [
        'CorrectsAmendsPriorReportIndicator',
        'FinCENDirectBackFileIndicator',
        'InitialReportIndicator',
      ],
      properties: {
        CorrectsAmendsPriorReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Corrects/Amends prior report (indicator)',
          description:
            'This element declares that the FinCEN SAR being filed corrects or amends a previously-filed FinCEN SAR',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        FinCENDirectBackFileIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        InitialReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Initial report (indicator)',
          description:
            'This element declares that the FinCEN SAR being filed is the first report filed on the suspicious activity',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
      },
      type: 'object',
    },
    PartyOccupationBusinessType: {
      required: [],
      properties: {
        NAICSCode: {
          $ref: '#/definitions/RestrictString6',
          title: 'NAICS Code',
          description:
            'This element identifies the North American Industry Classification System (NAICS) code for the occupation or type of business of the subject.',
        },
        OccupationBusinessText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Occupation or type of business',
          description:
            'This element identifies the description of the occupation, profession, or type of business of the subject.',
        },
      },
      type: 'object',
    },
    PartyNameType: {
      required: [],
      properties: {
        EntityLastNameUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Entity name or Individual last name unknown (indicator)',
          description:
            'This element declares that the person legal name (if entity) or last name (if individual) is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        FirstNameUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Individual first name unknown (indicator)',
          description:
            'This element declares that the first name of the subject is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        PartyNameTypeCode: {
          $ref: '#/definitions/ValidatePartyNameCodeType',
          title: 'Party name type (code)',
          description:
            'This element identifies the type of name recorded for the party; specifically, legal name, doing business as (DBA) name, or also known as (AKA) name.',
        },
        RawEntityIndividualLastName: {
          $ref: '#/definitions/RestrictString150',
          title: 'Entity name or Individual last name',
          description:
            'This element identifies the subject`s legal name, whether it be the legal name of the entity or the last name of the individual.',
        },
        RawIndividualFirstName: {
          $ref: '#/definitions/RestrictString35',
          title: 'First name',
          description: 'This element identifies the first name of the subject.',
        },
        RawIndividualMiddleName: {
          $ref: '#/definitions/RestrictString35',
          title: 'Middle name',
          description:
            'This element identifies the middle name of the subject.',
        },
        RawIndividualNameSuffixText: {
          $ref: '#/definitions/RestrictString35',
          title: 'Individual suffix name',
          description:
            'This element identifies the suffix name of the subject.',
        },
        RawPartyFullName: {
          $ref: '#/definitions/RestrictString150',
          title: 'Party full name',
          description:
            'This element identifies the full name of the party, whether it be the legal name if the institution, or DBA/AKA name of the institution or individual.',
        },
      },
      type: 'object',
    },
    PartyIdentificationType: {
      required: [],
      properties: {
        IdentificationPresentUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Identification unknown (indicator)',
          description:
            'This element declares that the form of identification used to verify the identity of the subject is unknown',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        OtherIssuerCountryText: {
          $ref: '#/definitions/RestrictString2',
          title: 'Identification issuing country (code)',
          description:
            ' This element identifies the country where the identification was issued by (or in) associated with the subject.',
        },
        OtherIssuerStateText: {
          $ref: '#/definitions/RestrictString3',
          title: 'Identification issuing state (code)',
          description:
            'This element identifies the state where the identification was issued by (or in) associated with the subject',
        },
        OtherPartyIdentificationTypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Identification type other description (text)',
          description:
            'This element identifies the other identification type associated with the party.',
        },
        PartyIdentificationNumberText: {
          $ref: '#/definitions/RestrictString25',
          title: 'Identification number',
          description:
            'This element identifies the form of identification number associated with the party.',
        },
        PartyIdentificationTypeCode: {
          $ref: '#/definitions/ValidatePartyIdentificationCodeType',
          title: 'Identification type (code)',
          description:
            'This element identifies the type of identification associated with the party.',
        },
        TINUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'TIN unknown (indicator)',
          description:
            'This element declares that the TIN associated with the party is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
      },
      type: 'object',
    },
    PhoneNumberType: {
      required: [],
      properties: {
        PhoneNumberExtensionText: {
          $ref: '#/definitions/RestrictString6',
          title: 'Telephone extension',
          description:
            'This element identifies the telephone extension associated with the telephone number of the party (if known)',
        },
        PhoneNumberText: {
          $ref: '#/definitions/RestrictString16',
          title: 'Telephone number',
          description:
            'This element identifies the telephone number of the party.',
        },
      },
      type: 'object',
    },
    ElectronicAddressType: {
      required: [],
      properties: {
        ElectronicAddressText: {
          $ref: '#/definitions/RestrictString517',
          title: 'Electronic address',
          description:
            'This element identifies the subject`s email address or website URL (Uniform Resource Locator) address.',
        },
      },
      type: 'object',
    },
    AccountType: {
      required: [],
      properties: {
        AccountNumberText: {
          $ref: '#/definitions/RestrictString40',
          title: 'Account number',
          description:
            'This element identifies the account number involved in the suspicious activity related to the recorded subject.',
        },
      },
      type: 'object',
    },
    PartyAccountAssociationType: {
      required: [],
      properties: {
        PartyAccountAssociationTypeCode: {
          $ref: '#/definitions/ValidatePartyAccountAssociationCodeType',
          title: 'Party account association type (code)',
          description: 'This element is for FinCEN purposes only.',
        },
      },
      type: 'object',
    },
    PartyType: {
      required: ['ActivityPartyTypeCode'],
      properties: {
        ActivityPartyTypeCode: {
          $ref: '#/definitions/ValidateActivityPartyCodeType',
          title: 'Party type',
          description:
            'This element identifies the type of party associated with the FinCEN SAR; specifically, the branch where activity occurred.',
        },
        BirthDateUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Date of birth unknown (indicator)',
          description:
            'This element identifies the date of birth associated with the subject.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        EFilingCoverageBeginningDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
        },
        EFilingCoverageEndDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
        },
        FemaleGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Gender (female)',
          description:
            'This element declares that the gender of the subject is female.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        IndividualBirthDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankTypeDOB',
          title: 'Date of birth',
          description:
            'This element declares that the date of birth associated with the subject is unknown.',
        },
        IndividualEntityCashInAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        IndividualEntityCashOutAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        MaleGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Gender (male)',
          description:
            'This element declares that the gender of the subject is male.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        MultipleTransactionsPersonsIndividualsIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        PartyAsEntityOrganizationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Check if entity',
          description: ' This element declares that the subject is an entity.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        PrimaryRegulatorTypeCode: {
          $ref: '#/definitions/ValidateFederalRegulatorCodeType',
          title: 'Primary regulator type (code)',
          description:
            'This element identifies the primary federal regulator or BSA examiner of the financial institution where activity occurred as well as the filing institution.',
        },
        UnknownGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Gender (unknown)',
          description:
            'This element declares that the gender of the subject is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
      },
      type: 'object',
    },
    OrganizationClassificationTypeSubtypeType: {
      required: ['OrganizationTypeID'],
      properties: {
        OrganizationSubtypeID: {
          $ref: '#/definitions/ValidateOrganizationSubtypeCodeType',
          title: 'Institution subtype (code)',
          description:
            ' This element identifies the specific type of gaming or securities/futures institution',
        },
        OrganizationTypeID: {
          $ref: '#/definitions/ValidateOrganizationCodeType',
          title: 'Institution type (code)',
          description: 'This element identifies the type of institution.',
        },
        OtherOrganizationSubTypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Institution subtype other (description)',
          description:
            'This element identifies the other type of gaming or securities/futures institution.',
        },
        OtherOrganizationTypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Institution type other (description)',
          description:
            'This element identifies the description of the other gaming or securities/futures institution.',
        },
      },
      type: 'object',
    },
    AddressType: {
      required: [],
      properties: {
        CityUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'City unknown (indicator)',
          description:
            'This element declares that the city associated with the address of the party is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        CountryCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Country unknown (indicator)',
          description:
            'This element declares that country associated with the address of the party is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        RawCityText: {
          $ref: '#/definitions/RestrictString50',
          title: 'City',
          description:
            'This element identifies the city associated with the address of the party.',
        },
        RawCountryCodeText: {
          $ref: '#/definitions/RestrictString2',
          title: 'Country (code)',
          description:
            'This element identifies the country associated with the party.',
          'ui:schema': {
            'ui:subtype': 'COUNTRY',
          },
        },
        RawStateCodeText: {
          $ref: '#/definitions/RestrictString3',
          title: 'State/Territory/Province (code)',
          description:
            'This element identifies the state/territory/province associated with the address of the party when the corresponding country is equal to US (United States), CA (Canada), MX (Mexico), or a U.S. Territory.',
          'ui:schema': {
            'ui:subtype': 'COUNTRY_REGION',
            'ui:countryField': 'RawCountryCodeText',
          },
        },
        RawStreetAddress1Text: {
          $ref: '#/definitions/RestrictString100',
          title: 'Street address',
          description:
            'This element identifies the street address of the party.',
        },
        RawZIPCode: {
          $ref: '#/definitions/RawZIPCodeType',
        },
        StateCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'State unknown (indicator)',
          description:
            'This element declares that state associated with the address of the party is unknown when the corresponding country is equal to US (United States), CA (Canada), or MX (Mexico).',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        StreetAddressUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Street address unknown (indicator)',
          description:
            'This element declares that the street address of the party is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        ZIPCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'ZIP/Postal Code unknown (indicator)',
          description:
            'This element declares that the ZIP Code or foreign postal code associated with the address of the party is unknown.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
      },
      type: 'object',
    },
    CurrencyTransactionActivityType: {
      required: [
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
      properties: {
        AggregateTransactionIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        ArmoredCarServiceIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        ATMIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        MailDepositShipmentIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        NightDepositIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        SharedBranchingIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        TotalCashInReceiveAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        TotalCashOutAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        TransactionDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
        },
      },
      type: 'object',
    },
    CurrencyTransactionActivityDetailType: {
      required: [
        'CurrencyTransactionActivityDetailTypeCode',
        'DetailTransactionAmountText',
        'OtherCurrencyTransactionActivityDetailText',
        'OtherForeignCurrencyCountryText',
      ],
      properties: {
        CurrencyTransactionActivityDetailTypeCode: {
          $ref: '#/definitions/ValidateCurrencyTransactionActvityDetailCodeType',
        },
        DetailTransactionAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        OtherCurrencyTransactionActivityDetailText: {
          $ref: '#/definitions/RestrictString50',
        },
        OtherForeignCurrencyCountryText: {
          $ref: '#/definitions/RestrictString2',
        },
      },
      type: 'object',
    },
    EFilingBatchXML: {
      required: [
        'FormTypeCode',
        'Activity',
        '@TotalAmount',
        '@PartyCount',
        '@ActivityCount',
      ],
      properties: {
        FormTypeCode: {
          type: 'string',
        },
        Activity: {
          items: {
            $ref: '#/definitions/Activity',
          },
          type: 'array',
        },
        '@TotalAmount': {
          type: 'number',
        },
        '@PartyCount': {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
        },
        '@ActivityCount': {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
        },
      },
      type: 'object',
      title: 'Batch acknowledgement',
      description:
        'This is the container for the contents of the batch acknowledgement file.',
    },
    Activity: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/ActivityType',
        },
        {
          required: [
            'ActivityAssociation',
            'Party',
            'CurrencyTransactionActivity',
          ],
          properties: {
            ActivityAssociation: {
              $ref: '#/definitions/ActivityAssociationType',
              title: 'Type of filing',
              description:
                'This element is the container for information about the type of filing associated with the FinCEN SAR.',
            },
            Party: {
              items: {
                $ref: '#/definitions/Party',
              },
              maxItems: 2002,
              minItems: 6,
              type: 'array',
              description:
                'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
            },
            CurrencyTransactionActivity: {
              $ref: '#/definitions/CurrencyTransactionActivity',
            },
            ActivityNarrativeInformation: {
              $ref: '#/definitions/ActivityNarrativeInformationType',
              title: 'Narrative',
              description:
                'This element is the container for information about narrative description associated with the FinCEN SAR.',
            },
          },
        },
      ],
    },
    Party: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/PartyType',
        },
        {
          required: ['PartyName'],
          properties: {
            PartyName: {
              items: {
                $ref: '#/definitions/PartyNameType',
              },
              maxItems: 2,
              type: 'array',
              title: 'Party name',
              description:
                'This is the container for information about the name of the party. The party name can be a legal name, doing business as (DBA) name, or also known as (AKA) name depending on the party type identified',
            },
            Address: {
              $ref: '#/definitions/AddressType',
              title: 'Address',
              description:
                'This is the container for information about the address of the party.',
            },
            PhoneNumber: {
              $ref: '#/definitions/PhoneNumberType',
              title: 'Telephone number',
              description:
                'This is the container for information about the telephone number of the party',
            },
            PartyIdentification: {
              items: {
                $ref: '#/definitions/PartyIdentificationType',
              },
              maxItems: 2,
              type: 'array',
              title: 'Party identification',
              description:
                'This is the container for information about the identification associated with the party.',
            },
            OrganizationClassificationTypeSubtype: {
              $ref: '#/definitions/OrganizationClassificationTypeSubtypeType',
              title: 'Institution type/subtype',
              description:
                'This is the container form information about the type and subtype of institution associated with the party.',
            },
            PartyOccupationBusiness: {
              $ref: '#/definitions/PartyOccupationBusinessType',
              title: 'Occupation or type of business',
              description:
                'This is the container for information about the occupation or type of business of the subject.',
            },
            ElectronicAddress: {
              $ref: '#/definitions/ElectronicAddressType',
              title: 'Electronic address',
              description:
                'This is the container for information about the subject`s e-mail address or website URL (Uniform Resource Locator). ',
            },
            Account: {
              oneOf: [
                {},
                {
                  items: {},
                  maxItems: 198,
                  type: 'array',
                },
              ],
              title: 'Account',
              description:
                'This is the container for information about the account (held at the corresponding financial institution) involved in the suspicious activity related to the recorded subject.',
            },
          },
        },
      ],
      description:
        'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
    },
    CurrencyTransactionActivity: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/CurrencyTransactionActivityType',
        },
        {
          required: ['CurrencyTransactionActivityDetail'],
          properties: {
            CurrencyTransactionActivityDetail: {
              items: {
                $ref: '#/definitions/CurrencyTransactionActivityDetailType',
              },
              maxItems: 219,
              type: 'array',
            },
          },
        },
      ],
    },
    ValidateIndicatorType: {
      enum: ['Y', ''],
      type: 'string',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
    },
    DateYYYYMMDDType: {
      pattern: '(19|20)[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[01])',
      type: 'string',
    },
    DateYYYYMMDDOrBlankType: {
      pattern: '(19|20)[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[01])|',
      type: 'string',
    },
    DateYYYYMMDDOrBlankTypeDOB: {
      pattern: '(19|20)[0-9][0-9](0[0-9]|1[0-2])(0[0-9]|1[0-9]|2[0-9]|3[01])|',
      type: 'string',
    },
    RestrictString2: {
      maxLength: 2,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString3: {
      maxLength: 3,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString6: {
      maxLength: 6,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString9: {
      maxLength: 9,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString15: {
      maxLength: 15,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString16: {
      maxLength: 16,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString25: {
      maxLength: 25,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString30: {
      maxLength: 30,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString35: {
      maxLength: 35,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString40: {
      maxLength: 40,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString50: {
      maxLength: 50,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString100: {
      maxLength: 100,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString150: {
      maxLength: 150,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    RestrictString517: {
      maxLength: 517,
      pattern: '\\S+( +\\S+)*|',
      type: 'string',
    },
    ValidateActivityPartyCodeType: {
      description: 'Contact for assistance',
      enum: ['35', '37', '30', '34', '50', '17', '23', '58', '8'],
      type: 'string',
      enumNames: [
        'Transmitter',
        'Transmitter Contact',
        'Reporting financial institution',
        'Transaction location business',
        'Person conducting transaction on own behalf',
        'Person conducting transaction for another',
        'Person on whose behalf this transaction was conducted',
        'Common carrier',
        'Contact for assistance',
      ],
    },
    ValidateOrganizationCodeType: {
      description: 'Other',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: ['1', '2', '4', '5', '999'],
      type: 'integer',
      enumNames: [
        'Casino/Card club',
        'Depository institution',
        'Money Services Business (MSB)',
        'Securities/Futures',
        'Other',
      ],
    },
    ValidateOrganizationSubtypeCodeType: {
      description: 'Other',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: ['101', '102', '103', '1999'],
      type: 'integer',
      enumNames: [
        'State licensed casino',
        'Tribal authorized casino',
        'Card club',
        'Other',
      ],
    },
    ValidatePartyNameCodeType: {
      description: 'Doing business as (DBA)',
      enum: ['L', 'AKA', 'DBA'],
      type: 'string',
      enumNames: [
        'Legal name',
        'Also known as (AKA)',
        'Doing business as (DBA)',
      ],
    },
    ValidatePartyAccountAssociationCodeType: {
      description: 'Activity affected account - Cash out',
      enum: ['8', '9'],
      type: 'string',
      enumNames: [
        'Activity affected account - Cash in',
        'Activity affected account - Cash out',
      ],
    },
    ValidateFederalRegulatorCodeType: {
      description: 'Unknown',
      enum: ['9', '1', '2', '7', '3', '4', '6', '14'],
      type: 'string',
      enumNames: [
        'CFTC',
        'Federal Reserve',
        'FDIC',
        'IRS',
        'NCUA',
        'OCC',
        'SEC',
        'Unknown',
      ],
    },
    ValidatePartyIdentificationCodeType: {
      description: 'Other',
      enum: [
        '1',
        '2',
        '4',
        '5',
        '6',
        '7',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '28',
        '999',
      ],
      type: 'string',
      enumNames: [
        'SSN/ITIN',
        'EIN',
        'TIN',
        "Driver's license/State ID",
        'Passport',
        'Alien registration',
        'Foreign',
        'CRD number',
        'IARD number',
        'NFA ID number',
        'SEC number',
        'RSSD number',
        'Transmitter Control Code',
        'Other',
      ],
    },
    ValidateCurrencyTransactionActvityDetailCodeType: {
      description: 'Foreign currency out',
      enum: [
        '55',
        '46',
        '23',
        '12',
        '14',
        '49',
        '18',
        '21',
        '25',
        '997',
        '56',
        '30',
        '32',
        '13',
        '15',
        '48',
        '28',
        '31',
        '33',
        '34',
        '998',
        '53',
        '54',
      ],
      type: 'string',
      enumNames: [
        'Deposit(s)',
        'Payment(s)',
        'Currency received from wire transfer(s) out',
        'Negotiable instrument(s) purchased',
        'Currency exchange in',
        'Currency to prepaid access',
        'Purchase(s) of casino chips, tokens, and other gaming instruments',
        'Currency wager(s) (including money plays)',
        'Bills inserted into gaming devices',
        'Other cash in',
        'Withdrawal(s)',
        'Advance(s) on credit (including markers)',
        'Currency paid from wire transfer(s) in',
        'Negotiable instrument(s) cashed',
        'Currency exchange out',
        'Currency from prepaid access',
        'Redemption(s) of casino chips, tokens, TITO tickets, and other gaming instruments',
        'Payment(s) on wager(s)/bet(s) (Including race book, slot jackpot(s) and OTB or sports pool)',
        'Travel and complimentary expenses and gaming incentives',
        'Payment for tournament, contest or other promotions',
        'Other cash out',
        'Foreign currency in',
        'Foreign currency out',
      ],
    },
    ActivityNarrativeInformationType: {
      required: ['ActivityNarrativeText'],
      properties: {
        ActivityNarrativeText: {
          maxLength: 16000,
          type: 'string',
          title: 'Narrative (description)',
          description:
            'This element records the narrative description associated with the suspicious activity. The narrative must provide a clear, complete, and concise description of the activity, including what was unusual or irregular that caused suspicion. ',
          'ui:schema': {
            'ui:subtype': 'NARRATIVE',
          },
        },
      },
      type: 'object',
    },
    RawZIPCodeType: {
      type: 'string',
      maxLength: 9,
      pattern: '^[a-zA-Z0-9]+$',
    },
  },
}
