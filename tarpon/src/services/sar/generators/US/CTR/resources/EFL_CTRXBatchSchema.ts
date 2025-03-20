export const FincenJsonSchema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Thu Mar 20 2025 01:04:05 GMT+0530 (India Standard Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    "Schema tag attributes: xmlns='www.fincen.gov/base' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:vc='http://www.w3.org/2007/XMLSchema-versioning' targetNamespace='www.fincen.gov/base' elementFormDefault='qualified' attributeFormDefault='unqualified' vc:minVersion='1.1'",
  properties: {
    EFilingBatchXML: {
      $ref: '#/definitions/EFilingBatchXML',
    },
  },
  type: 'object',
  definitions: {
    ExtentsionActivityType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/ActivityType',
        },
        {
          required: ['FilingDateText'],
          properties: {
            EFilingPriorDocumentNumber: {
              maximum: 9223372036854776000,
              minimum: -9223372036854776000,
              type: 'integer',
            },
            FilingDateText: {
              $ref: '#/definitions/DateYYYYMMDDType',
            },
          },
        },
      ],
    },
    ExtentsionActivityAssociationType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/ActivityAssociationType',
        },
        {
          required: [
            'CorrectsAmendsPriorReportIndicator',
            'FinCENDirectBackFileIndicator',
            'InitialReportIndicator',
          ],
          properties: {
            CorrectsAmendsPriorReportIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            FinCENDirectBackFileIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            InitialReportIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
          },
        },
      ],
    },
    ExtentsionPartyOccupationBusinessType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PartyOccupationBusinessType',
        },
        {
          required: [],
          properties: {
            NAICSCode: {
              $ref: '#/definitions/RestrictString6',
            },
            OccupationBusinessText: {
              $ref: '#/definitions/RestrictString50',
            },
          },
        },
      ],
    },
    ExtentsionPartyNameType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PartyNameType',
        },
        {
          required: [],
          properties: {
            EntityLastNameUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            FirstNameUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            PartyNameTypeCode: {
              $ref: '#/definitions/ValidatePartyNameCodeType',
            },
            RawEntityIndividualLastName: {
              $ref: '#/definitions/RestrictString150',
            },
            RawIndividualFirstName: {
              $ref: '#/definitions/RestrictString35',
            },
            RawIndividualMiddleName: {
              $ref: '#/definitions/RestrictString35',
            },
            RawIndividualNameSuffixText: {
              $ref: '#/definitions/RestrictString35',
            },
            RawPartyFullName: {
              $ref: '#/definitions/RestrictString150',
            },
          },
        },
      ],
    },
    ExtentsionPartyIdentificationType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PartyIdentificationType',
        },
        {
          required: [],
          properties: {
            IdentificationPresentUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            OtherIssuerCountryText: {
              $ref: '#/definitions/RestrictString2',
            },
            OtherIssuerStateText: {
              $ref: '#/definitions/RestrictString3',
            },
            OtherPartyIdentificationTypeText: {
              $ref: '#/definitions/RestrictString50',
            },
            PartyIdentificationNumberText: {
              $ref: '#/definitions/RestrictString25',
            },
            PartyIdentificationTypeCode: {
              $ref: '#/definitions/ValidatePartyIdentificationCodeType',
            },
            TINUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
          },
        },
      ],
    },
    ExtentsionPhoneNumberType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PhoneNumberType',
        },
        {
          required: [],
          properties: {
            PhoneNumberExtensionText: {
              $ref: '#/definitions/RestrictString6',
            },
            PhoneNumberText: {
              $ref: '#/definitions/RestrictString16',
            },
          },
        },
      ],
    },
    ExtentsionElectronicAddressType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/ElectronicAddressType',
        },
        {
          required: [],
          properties: {
            ElectronicAddressText: {
              $ref: '#/definitions/RestrictString517',
            },
          },
        },
      ],
    },
    ExtentsionAccountType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/AccountType',
        },
        {
          required: [],
          properties: {
            AccountNumberText: {
              $ref: '#/definitions/RestrictString40',
            },
          },
        },
      ],
    },
    ExtentsionPartyAccountAssociationType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PartyAccountAssociationType',
        },
        {
          required: [],
          properties: {
            PartyAccountAssociationTypeCode: {
              $ref: '#/definitions/ValidatePartyAccountAssociationCodeType',
            },
          },
        },
      ],
    },
    ExtentsionPartyType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/PartyType',
        },
        {
          required: ['ActivityPartyTypeCode'],
          properties: {
            ActivityPartyTypeCode: {
              $ref: '#/definitions/ValidateActivityPartyCodeType',
            },
            BirthDateUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            EFilingCoverageBeginningDateText: {
              $ref: '#/definitions/DateYYYYMMDDType',
            },
            EFilingCoverageEndDateText: {
              $ref: '#/definitions/DateYYYYMMDDType',
            },
            FemaleGenderIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            IndividualBirthDateText: {
              $ref: '#/definitions/DateYYYYMMDDOrBlankTypeDOB',
            },
            IndividualEntityCashInAmountText: {
              $ref: '#/definitions/RestrictString15',
            },
            IndividualEntityCashOutAmountText: {
              $ref: '#/definitions/RestrictString15',
            },
            MaleGenderIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            MultipleTransactionsPersonsIndividualsIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            PartyAsEntityOrganizationIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            PrimaryRegulatorTypeCode: {
              $ref: '#/definitions/ValidateFederalRegulatorCodeType',
            },
            UnknownGenderIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
          },
        },
      ],
    },
    ExtentsionOrganizationClassificationTypeSubtypeType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/OrganizationClassificationTypeSubtypeType',
        },
        {
          required: ['OrganizationTypeID'],
          properties: {
            OrganizationSubtypeID: {
              $ref: '#/definitions/ValidateOrganizationSubtypeCodeType',
            },
            OrganizationTypeID: {
              $ref: '#/definitions/ValidateOrganizationCodeType',
            },
            OtherOrganizationSubTypeText: {
              $ref: '#/definitions/RestrictString50',
            },
            OtherOrganizationTypeText: {
              $ref: '#/definitions/RestrictString50',
            },
          },
        },
      ],
    },
    ExtentsionAddressType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/AddressType',
        },
        {
          required: [],
          properties: {
            CityUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            CountryCodeUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            RawCityText: {
              $ref: '#/definitions/RestrictString50',
            },
            RawCountryCodeText: {
              $ref: '#/definitions/RestrictString2',
            },
            RawStateCodeText: {
              $ref: '#/definitions/RestrictString3',
            },
            RawStreetAddress1Text: {
              $ref: '#/definitions/RestrictString100',
            },
            RawZIPCode: {
              $ref: '#/definitions/RestrictString9',
            },
            StateCodeUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            StreetAddressUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            ZIPCodeUnknownIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
          },
        },
      ],
    },
    ExtentsionCurrencyTransactionActivityType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/CurrencyTransactionActivityType',
        },
        {
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
            },
            ArmoredCarServiceIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            ATMIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            MailDepositShipmentIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            NightDepositIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
            },
            SharedBranchingIndicator: {
              $ref: '#/definitions/ValidateIndicatorType',
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
        },
      ],
    },
    ExtentsionCurrencyTransactionActivityDetailType: {
      type: 'object',
      allOf: [
        {
          $ref: '0.json#/definitions/CurrencyTransactionActivityDetailType',
        },
        {
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
        },
      ],
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
    },
    Activity: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/ExtentsionActivityType',
        },
        {
          required: [
            'ActivityAssociation',
            'Party',
            'CurrencyTransactionActivity',
          ],
          properties: {
            ActivityAssociation: {
              $ref: '0.json#/definitions/ActivityAssociationType',
            },
            Party: {
              items: {
                $ref: '#/definitions/Party',
              },
              maxItems: 2002,
              minItems: 6,
              type: 'array',
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
          $ref: '#/definitions/ExtentsionPartyType',
        },
        {
          required: ['PartyName'],
          properties: {
            PartyName: {
              items: {
                $ref: '0.json#/definitions/PartyNameType',
              },
              maxItems: 2,
              type: 'array',
            },
            Address: {
              $ref: '0.json#/definitions/AddressType',
            },
            PhoneNumber: {
              $ref: '0.json#/definitions/PhoneNumberType',
            },
            PartyIdentification: {
              items: {
                $ref: '0.json#/definitions/PartyIdentificationType',
              },
              maxItems: 2,
              type: 'array',
            },
            OrganizationClassificationTypeSubtype: {
              $ref: '0.json#/definitions/OrganizationClassificationTypeSubtypeType',
            },
            PartyOccupationBusiness: {
              $ref: '0.json#/definitions/PartyOccupationBusinessType',
            },
            ElectronicAddress: {
              $ref: '0.json#/definitions/ElectronicAddressType',
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
            },
          },
        },
      ],
    },
    CurrencyTransactionActivity: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/ExtentsionCurrencyTransactionActivityType',
        },
        {
          required: ['CurrencyTransactionActivityDetail'],
          properties: {
            CurrencyTransactionActivityDetail: {
              items: {
                $ref: '0.json#/definitions/CurrencyTransactionActivityDetailType',
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
