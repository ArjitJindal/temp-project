export const FincenJsonSchema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Thu Jul 27 2023 15:07:49 GMT+0200 (Central European Summer Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    "Schema tag attributes: xmlns='www.fincen.gov/base' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:vc='http://www.w3.org/2007/XMLSchema-versioning' xmlns:fc2='www.fincen.gov/base' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' targetNamespace='www.fincen.gov/base' elementFormDefault='qualified' attributeFormDefault='unqualified' vc:minVersion='1.1'",
  properties: {
    EFilingBatchXML: {
      $ref: '#/definitions/EFilingBatchXML',
    },
  },
  type: 'object',
  definitions: {
    AccountType: {
      required: [],
      properties: {
        AccountNumberText: {
          $ref: '#/definitions/RestrictString40',
        },
      },
      type: 'object',
    },
    ActivityAssociationType: {
      required: [],
      properties: {
        ContinuingActivityReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Continuing activity report (indicator)',
          description:
            'This element declares that the FinCEN SAR being filed continues reporting on a previously-reported suspicious activity',
        },
        CorrectsAmendsPriorReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Corrects/Amends prior report (indicator)',
          description:
            'This element declares that the FinCEN SAR being filed corrects or amends a previously-filed FinCEN SAR',
        },
        InitialReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Initial report (indicator)',
          description:
            'This element declares that the FinCEN SAR being filed is the first report filed on the suspicious activity',
        },
        JointReportIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Joint report (indicator)',
          description:
            'This element declares that the FinCEN SAR is being filed jointly by two or morefinancial institutions.',
        },
      },
      type: 'object',
    },
    ActivityIPAddressType: {
      required: ['IPAddressText'],
      properties: {
        ActivityIPAddressDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
        },
        ActivityIPAddressTimeStampText: {
          $ref: '#/definitions/ValidateTimeDataOrBlankType',
        },
        IPAddressText: {
          $ref: '#/definitions/RestrictString39',
        },
      },
      type: 'object',
    },
    ActivityNarrativeInformationType: {
      required: ['ActivityNarrativeSequenceNumber', 'ActivityNarrativeText'],
      properties: {
        ActivityNarrativeSequenceNumber: {
          $ref: '#/definitions/ValidateActivityNarrativeSequenceNumber',
        },
        ActivityNarrativeText: {
          $ref: '#/definitions/RestrictString4000',
        },
      },
      type: 'object',
    },
    ActivitySupportDocumentType: {
      required: ['OriginalAttachmentFileName'],
      properties: {
        OriginalAttachmentFileName: {
          $ref: '#/definitions/RestrictString150',
        },
      },
      type: 'object',
    },
    ActivityType: {
      required: ['FilingDateText'],
      properties: {
        EFilingPriorDocumentNumber: {
          $ref: '#/definitions/RestrictLong14',
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
        FilingInstitutionNotetoFinCEN: {
          $ref: '#/definitions/RestrictString50',
          title: 'Filing Institution Note to FinCEN',
          description:
            'This element allows the filer to alert FinCEN that this FinCEN SAR is being filed in response to a current specific geographic targeting order (GTO) or advisory or other activity. The value provided must adhere to the following requirements: 50 characters or less.',
        },
      },
      type: 'object',
    },
    AddressType: {
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
      type: 'object',
    },
    AssetsAttributeType: {
      required: ['AssetAttributeTypeID'],
      properties: {
        AssetAttributeDescriptionText: {
          $ref: '#/definitions/RestrictString50',
        },
        AssetAttributeTypeID: {
          $ref: '#/definitions/ValidateAssetAttributeTypeIDTypeCode',
        },
      },
      type: 'object',
    },
    AssetsTableType: {
      required: ['AssetSubtypeID', 'AssetTypeID'],
      properties: {
        AssetSubtypeID: {
          $ref: '#/definitions/ValidateAssetSubtypeIDTypeCode',
        },
        AssetTypeID: {
          $ref: '#/definitions/ValidateAssetTypeIDTypeCode',
        },
        OtherAssetSubtypeText: {
          $ref: '#/definitions/RestrictString50',
        },
      },
      type: 'object',
    },
    CyberEventIndicatorsType: {
      required: ['CyberEventIndicatorsTypeCode', 'EventValueText'],
      properties: {
        CyberEventDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
        },
        CyberEventIndicatorsTypeCode: {
          $ref: '#/definitions/ValidateCyberEventIndicatorsTypeCode',
        },
        CyberEventTimeStampText: {
          $ref: '#/definitions/ValidateTimeDataOrBlankType',
        },
        CyberEventTypeOtherText: {
          $ref: '#/definitions/RestrictString50',
        },
        EventValueText: {
          $ref: '#/definitions/RestrictString4000',
        },
      },
      type: 'object',
    },
    ElectronicAddressType: {
      required: ['ElectronicAddressText', 'ElectronicAddressTypeCode'],
      properties: {
        ElectronicAddressText: {
          $ref: '#/definitions/RestrictString517',
        },
        ElectronicAddressTypeCode: {
          $ref: '#/definitions/ValidateElectronicAddressTypeCode',
        },
      },
      type: 'object',
    },
    OrganizationClassificationTypeSubtypeType: {
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
      type: 'object',
    },
    PartyAccountAssociationType: {
      required: ['PartyAccountAssociationTypeCode'],
      properties: {
        AccountClosedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        PartyAccountAssociationTypeCode: {
          $ref: '#/definitions/ValidatePartyAccountAssociationCodeType',
        },
      },
      type: 'object',
    },
    PartyAssociationType: {
      required: [],
      properties: {
        AccountantIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        ActionTakenDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
        },
        AgentIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        AppraiserIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        AttorneyIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        BorrowerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        CustomerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        DirectorIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        EmployeeIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        NoRelationshipToInstitutionIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        OfficerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        OtherPartyAssociationTypeText: {
          $ref: '#/definitions/RestrictString50',
        },
        OtherRelationshipIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        OwnerShareholderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        RelationshipContinuesIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        ResignedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        SubjectRelationshipFinancialInstitutionTINText: {
          $ref: '#/definitions/RestrictString25',
        },
        SuspendedBarredIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        TerminatedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
      },
      type: 'object',
    },
    PartyIdentificationType: {
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
      type: 'object',
    },
    PartyNameType: {
      required: ['PartyNameTypeCode'],
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
      type: 'object',
    },
    PartyOccupationBusinessType: {
      required: [],
      properties: {
        NAICSCode: {
          $ref: '#/definitions/RestrictString6',
        },
        OccupationBusinessText: {
          $ref: '#/definitions/RestrictString50',
        },
      },
      type: 'object',
    },
    PartyType: {
      required: ['ActivityPartyTypeCode'],
      properties: {
        ActivityPartyTypeCode: {
          $ref: '#/definitions/ValidateActivityPartyCodeType',
        },
        AdmissionConfessionNoIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Corroborative statement to filer: No (indicator)',
          description:
            'This element declares that the subject individual has made no corroborative statement to the filer',
        },
        AdmissionConfessionYesIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Corroborative statement to filer: Yes (indicator)',
          description:
            ' This element declares that the subject individual has made a statement to the filer admitting to involvement in or otherwise substantiating the suspicious activity.',
        },
        AllCriticalSubjectInformationUnavailableIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'All critical subject information unavailable (indicator)',
          description:
            'This element declares that all critical subject information is unavailable',
        },
        BirthDateUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Date of birth unknown (indicator)',
        },
        BothPurchaserSenderPayeeReceiveIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        ContactDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
        },
        FemaleGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        IndividualBirthDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankTypeDOB',
        },
        LossToFinancialAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        MaleGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        NoBranchActivityInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        NoKnownAccountInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        NonUSFinancialInstitutionIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        PartyAsEntityOrganizationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        PayeeReceiverIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        PayLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        PrimaryRegulatorTypeCode: {
          $ref: '#/definitions/ValidateFederalRegulatorCodeType',
        },
        PurchaserSenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        SellingLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        SellingPayingLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        UnknownGenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
      },
      type: 'object',
    },
    PhoneNumberType: {
      required: [],
      properties: {
        PhoneNumberExtensionText: {
          $ref: '#/definitions/RestrictString6',
        },
        PhoneNumberText: {
          $ref: '#/definitions/RestrictString16',
        },
        PhoneNumberTypeCode: {
          $ref: '#/definitions/ValidatePhoneNumberCodeType',
        },
      },
      type: 'object',
    },
    SuspiciousActivityClassificationType: {
      required: ['SuspiciousActivitySubtypeID', 'SuspiciousActivityTypeID'],
      properties: {
        OtherSuspiciousActivityTypeText: {
          $ref: '#/definitions/RestrictString50',
        },
        SuspiciousActivitySubtypeID: {
          $ref: '#/definitions/ValidateSuspiciousActivitySubtypeID',
        },
        SuspiciousActivityTypeID: {
          $ref: '#/definitions/ValidateSuspiciousActivityTypeID',
        },
      },
      type: 'object',
    },
    SuspiciousActivityType: {
      required: ['SuspiciousActivityFromDateText'],
      properties: {
        AmountUnknownIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        CumulativeTotalViolationAmountText: {
          $ref: '#/definitions/RestrictString15',
        },
        NoAmountInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
        },
        SuspiciousActivityFromDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
        },
        SuspiciousActivityToDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
        },
        TotalSuspiciousAmountText: {
          $ref: '#/definitions/RestrictString15',
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
        '@ActivityAttachmentCount',
        '@AttachmentCount',
      ],
      properties: {
        FormTypeCode: {
          type: 'string',
        },
        Activity: {
          oneOf: [
            {
              $ref: '#/definitions/Activity',
            },
            {
              items: {
                $ref: '#/definitions/Activity',
              },
              type: 'array',
            },
          ],
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
        '@ActivityAttachmentCount': {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
        },
        '@AttachmentCount': {
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
          $ref: '#/definitions/ActivityType',
        },
        {
          required: [
            'ActivityAssociation',
            'Party',
            'SuspiciousActivity',
            'ActivityNarrativeInformation',
          ],
          properties: {
            ActivityAssociation: {
              $ref: '#/definitions/ActivityAssociationType',
            },
            ActivitySupportDocument: {
              $ref: '#/definitions/ActivitySupportDocumentType',
            },
            Party: {
              oneOf: [
                {
                  $ref: '#/definitions/Party',
                },
                {
                  items: {
                    $ref: '#/definitions/Party',
                  },
                  maxItems: 1203,
                  minItems: 6,
                  type: 'array',
                },
              ],
            },
            SuspiciousActivity: {
              $ref: '#/definitions/SuspiciousActivity',
            },
            ActivityIPAddress: {
              oneOf: [
                {
                  $ref: '#/definitions/ActivityIPAddressType',
                },
                {
                  items: {
                    $ref: '#/definitions/ActivityIPAddressType',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
            CyberEventIndicators: {
              oneOf: [
                {
                  $ref: '#/definitions/CyberEventIndicatorsType',
                },
                {
                  items: {
                    $ref: '#/definitions/CyberEventIndicatorsType',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
            Assets: {
              oneOf: [
                {
                  $ref: '#/definitions/AssetsTableType',
                },
                {
                  items: {
                    $ref: '#/definitions/AssetsTableType',
                  },
                  maxItems: 31,
                  type: 'array',
                },
              ],
            },
            AssetsAttribute: {
              oneOf: [
                {
                  $ref: '#/definitions/AssetsAttributeType',
                },
                {
                  items: {
                    $ref: '#/definitions/AssetsAttributeType',
                  },
                  maxItems: 396,
                  type: 'array',
                },
              ],
            },
            ActivityNarrativeInformation: {
              oneOf: [
                {
                  $ref: '#/definitions/ActivityNarrativeInformationType',
                },
                {
                  items: {
                    $ref: '#/definitions/ActivityNarrativeInformationType',
                  },
                  maxItems: 5,
                  type: 'array',
                },
              ],
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
          properties: {
            PartyName: {
              oneOf: [
                {
                  $ref: '#/definitions/PartyNameType',
                },
                {
                  items: {
                    $ref: '#/definitions/PartyNameType',
                  },
                  maxItems: 100,
                  type: 'array',
                },
              ],
            },
            Address: {
              oneOf: [
                {
                  $ref: '#/definitions/AddressType',
                },
                {
                  items: {
                    $ref: '#/definitions/AddressType',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
            PhoneNumber: {
              oneOf: [
                {
                  $ref: '#/definitions/PhoneNumberType',
                },
                {
                  items: {
                    $ref: '#/definitions/PhoneNumberType',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
            PartyIdentification: {
              oneOf: [
                {
                  $ref: '#/definitions/PartyIdentificationType',
                },
                {
                  items: {
                    $ref: '#/definitions/PartyIdentificationType',
                  },
                  maxItems: 100,
                  type: 'array',
                },
              ],
            },
            OrganizationClassificationTypeSubtype: {
              oneOf: [
                {
                  $ref: '#/definitions/OrganizationClassificationTypeSubtypeType',
                },
                {
                  items: {
                    $ref: '#/definitions/OrganizationClassificationTypeSubtypeType',
                  },
                  maxItems: 15,
                  type: 'array',
                },
              ],
            },
            PartyOccupationBusiness: {
              $ref: '#/definitions/PartyOccupationBusinessType',
            },
            ElectronicAddress: {
              oneOf: [
                {
                  $ref: '#/definitions/ElectronicAddressType',
                },
                {
                  items: {
                    $ref: '#/definitions/ElectronicAddressType',
                  },
                  maxItems: 198,
                  type: 'array',
                },
              ],
            },
            PartyAssociation: {
              oneOf: [
                {
                  $ref: '#/definitions/PartyAssociation',
                },
                {
                  items: {
                    $ref: '#/definitions/PartyAssociation',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
            PartyAccountAssociation: {
              $ref: '#/definitions/PartyAccountAssociation',
            },
          },
        },
      ],
    },
    PartyAssociation: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/PartyAssociationType',
        },
        {
          properties: {
            Party: {
              oneOf: [
                {},
                {
                  items: {},
                  maxItems: 99,
                  type: 'array',
                },
              ],
            },
          },
        },
      ],
    },
    PartyAccountAssociation: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/PartyAccountAssociationType',
        },
        {
          required: ['Party'],
          properties: {
            Party: {
              oneOf: [
                {},
                {
                  items: {},
                  maxItems: 99,
                  minItems: 1,
                  type: 'array',
                },
              ],
            },
          },
        },
      ],
    },
    SuspiciousActivity: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/SuspiciousActivityType',
        },
        {
          required: ['SuspiciousActivityClassification'],
          properties: {
            SuspiciousActivityClassification: {
              oneOf: [
                {
                  $ref: '#/definitions/SuspiciousActivityClassificationType',
                },
                {
                  items: {
                    $ref: '#/definitions/SuspiciousActivityClassificationType',
                  },
                  maxItems: 99,
                  type: 'array',
                },
              ],
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
    ValidateTimeDataOrBlankType: {
      pattern: '([0-1][0-9]|(2[0-3])):[0-5][0-9]:[0-5][0-9]|',
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
    RestrictLong14: {
      maximum: 9223372036854776000,
      minimum: -9223372036854776000,
      type: 'integer',
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
    RestrictString39: {
      maxLength: 39,
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
    RestrictString4000: {
      maxLength: 4000,
      type: 'string',
    },
    ValidateActivityPartyCodeType: {
      description: 'Financial Institution in which account is held',
      enum: ['35', '37', '30', '33', '34', '8', '46', '18', '19', '41'],
      type: 'string',
      enumNames: [
        'Transmitter',
        'Transmitter Contact',
        'Reporting financial institution',
        'Subject',
        'Transaction location business',
        'Contact for assistance',
        'Transaction location branch',
        'Law enforcement or regulator contact',
        'Name of person contacted at Law enforcement or regulator',
        'Financial Institution in which account is held',
      ],
    },
    ValidateOrganizationCodeType: {
      description: 'Other',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: ['1', '2', '3', '4', '5', '11', '12', '999'],
      type: 'integer',
      enumNames: [
        'Casino/Card club',
        'Depository institution',
        'Insurance company',
        'Money Services Business (MSB)',
        'Securities/Futures',
        'Loan or Finance Company',
        'Housing GSE',
        'Other',
      ],
    },
    ValidateOrganizationSubtypeCodeType: {
      description: 'Other securities/futures',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: [
        '101',
        '102',
        '103',
        '503',
        '504',
        '508',
        '513',
        '514',
        '535',
        '528',
        '529',
        '533',
        '534',
        '539',
        '540',
        '541',
        '542',
        '1999',
        '5999',
      ],
      type: 'integer',
      enumNames: [
        'State licensed casino',
        'Tribal authorized casino',
        'Card club',
        'Subsidiary of financial/bank holding company',
        'Holding company',
        'Futures commission merchant (FCM)',
        'Introducing Broker-Commodity (IB-C)',
        'Investment adviser (IA)',
        'Clearing broker-securities',
        'Self regulatory organization (SRO) futures',
        'Self regulatory organization (SRO) securities',
        'Retail foreign exchange dealer',
        'CPO/CTA',
        'Investment company',
        'Introducing broker-securities',
        'Execution-only broker-securities',
        'Self-clearing broker-securities',
        'Other gaming institution',
        'Other securities/futures',
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
      description: 'Activity affected account',
      enum: ['5', '7'],
      type: 'string',
      enumNames: [
        'Institution in which account is held',
        'Activity affected account',
      ],
    },
    ValidateFederalRegulatorCodeType: {
      description: 'Not applicable',
      enum: ['9', '1', '2', '7', '3', '4', '6', '13', '99'],
      type: 'string',
      enumNames: [
        'CFTC',
        'Federal Reserve',
        'FDIC',
        'IRS',
        'NCUA',
        'OCC',
        'SEC',
        'FHFA',
        'Not applicable',
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
        '32',
        '33',
        '29',
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
        'NAIC number',
        'NMLS Id number',
        'Internal Control Number',
        'Other',
      ],
    },
    ValidatePhoneNumberCodeType: {
      description: 'Work',
      enum: ['F', 'M', 'R', 'W'],
      type: 'string',
      enumNames: ['Facsimile', 'Mobile', 'Residence', 'Work'],
    },
    ValidateElectronicAddressTypeCode: {
      description: 'URL',
      enum: ['E', 'U'],
      type: 'string',
      enumNames: ['Email', 'URL'],
    },
    ValidateSuspiciousActivityTypeID: {
      description: 'Cyber event',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: ['1', '12', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      type: 'integer',
      enumNames: [
        'Structuring',
        'Gaming activities',
        'Fraud',
        'Identification documentation',
        'Insurance',
        'Securities/Futures/Options',
        'Terrorist financing',
        'Money laundering',
        'Other suspicious activities',
        'Mortgage Fraud',
        'Cyber event',
      ],
    },
    ValidateSuspiciousActivitySubtypeID: {
      description: 'Other',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: [
        '106',
        '111',
        '112',
        '113',
        '114',
        '301',
        '304',
        '305',
        '308',
        '309',
        '310',
        '312',
        '320',
        '321',
        '322',
        '323',
        '324',
        '325',
        '401',
        '402',
        '403',
        '404',
        '405',
        '409',
        '501',
        '502',
        '504',
        '505',
        '506',
        '507',
        '601',
        '603',
        '604',
        '608',
        '609',
        '701',
        '801',
        '804',
        '805',
        '806',
        '807',
        '808',
        '809',
        '812',
        '820',
        '821',
        '822',
        '823',
        '824',
        '901',
        '903',
        '904',
        '905',
        '907',
        '908',
        '909',
        '910',
        '911',
        '913',
        '917',
        '920',
        '921',
        '922',
        '924',
        '925',
        '926',
        '927',
        '928',
        '1001',
        '1003',
        '1005',
        '1006',
        '1007',
        '1101',
        '1102',
        '1201',
        '1202',
        '1203',
        '1204',
        '1999',
        '3999',
        '4999',
        '5999',
        '6999',
        '7999',
        '8999',
        '9999',
        '10999',
        '11999',
        '12999',
      ],
      type: 'integer',
      enumNames: [
        'Suspicious inquiry by customer regarding BSA reporting or recordkeeping requirements',
        'Alters or cancels transaction to avoid BSA recordkeeping requirement',
        'Alters or cancels transaction to avoid CTR requirement',
        'Transaction(s) below BSA recordkeeping threshold',
        'Transaction(s) below CTR threshold',
        'Check',
        'Consumer Loan',
        'Credit/Debit Card',
        'Mail',
        'Mass-marketing',
        'Pyramid scheme',
        'Wire transfer',
        'ACH',
        'Business loan',
        'Advance fee',
        'Healthcase/Public or private health insurance',
        'Ponzi scheme',
        'Securities fraud',
        'Changes spelling or arrangement of name',
        'Multiple individuals with same or similar identities',
        'Provided questionable or false documentation',
        'Refused or avoided request for documentation',
        'Single individual with multiple identities',
        'Provided questionable or false identification',
        'Excessive insurance',
        'Excessive or unusal cash borrowing against policy/annuity',
        'Proceeds sent to unrelated third party',
        "Suspicious life settlement sales insurance (e.g., STOLI's, Viaticals)",
        'Suspicious termination of policy or contract',
        'Unclear or no insurable interest',
        'Insider trading',
        'Misappropriation',
        'Unauthorized pooling',
        'Market manipulation',
        'Wash trading',
        'Known or suspected terrorist/terrorist organization',
        'Exchanges small bills for large bills or vice versa',
        'Suspicious designation of beneficiaries, assignees or joint owners',
        'Suspicious EFT/wire transfers',
        'Suspicious receipt of government payments/benefits',
        'Suspicious use of multiple accounts',
        'Suspicious use of noncash monetary instruments',
        'Suspicious use of third-party transactors (straw-man)',
        'Transaction out of pattern for customer(s)',
        'Suspicious concerning the physical condition of funds',
        'Suspicious concerning the source of funds',
        'Suspicious exchange of currencies',
        'Trade Based Money Laundering/Black Market Peso Exchange',
        'Funnel account',
        'Bribery or gratuity',
        'Embezzlement/theft/disappearance of funds',
        'Forgeries',
        'Identity theft',
        'Suspected public/private corruption (domestic)',
        'Suspected public/private corruption (foreign)',
        'Suspicious use of informal value transfer system',
        'Suspicious use of multiple locations',
        'Two or more individuals working together',
        'Unlicensed or unregistered MSB',
        'Counterfeit Instrument (other)',
        'Account takeover',
        'Elder financial exploitation',
        'Little or no concern for product performance penalites, fees, or tax consequences',
        'Misuse of position or self-dealing',
        'Transaction with no apparent economic, business, or lawful purpose',
        'Human smuggling',
        'Human trafficking',
        'Transaction(s) involving foreign high risk jurisdiction',
        'Appraisal fraud',
        'Loan Modification fraud',
        'Application fraud',
        'Foreclosure/Short sale fraud',
        'Origination fraud',
        'Against financial institution(s)',
        'Against financial institution customer(s)',
        'Chip walking',
        'Minimal gaming with large transactions',
        'Suspicious use of counter checks or markers',
        'Unknown source of chips',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
        'Other',
      ],
    },
    ValidateAssetSubtypeIDTypeCode: {
      description: 'Microcap Securities',
      maximum: 9223372036854776000,
      minimum: -9223372036854776000,
      enum: [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '16',
        '17',
        '18',
        '19',
        '20',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        '39',
        '41',
        '46',
        '47',
      ],
      type: 'integer',
      enumNames: [
        'Other Financial instrument, product or service',
        'Bonds/Notes',
        'Commercial mortgage',
        'Commercial paper',
        'Credit card',
        'Debit card',
        'Forex transactions',
        'Futures/Options on futures',
        'Hedge fund',
        'Home equity loan',
        'Home equity line of credit',
        'Insurance/Annuity products',
        'Mutual fund',
        'Options on securities',
        'Prepaid access',
        'Residential mortgage',
        'Security futures products',
        'Stocks',
        'Swap, hybrid, or other derivative',
        'Other Financial product',
        "Bank/Cashier's check",
        'Foreign currency',
        'Funds transfer',
        'Gaming instruments',
        'Government payment',
        'Money orders',
        'Personal/Business check',
        'Travelers checks',
        'U.S. Currency',
        'Other Financial instrument or payment mechanism',
        'Deposit account',
        'Microcap Securities',
      ],
    },
    ValidateAssetTypeIDTypeCode: {
      description: 'Financial instrument or payment mechanism',
      maximum: 9223372036854776000,
      minimum: -9223372036854776000,
      enum: ['5', '6'],
      type: 'integer',
      enumNames: [
        'Financial Product',
        'Financial instrument or payment mechanism',
      ],
    },
    ValidateAssetAttributeTypeIDTypeCode: {
      description: 'Market Where Traded Code',
      maximum: 9223372036854776000,
      minimum: -9223372036854776000,
      enum: ['1', '2', '3', '4'],
      type: 'integer',
      enumNames: [
        'CUSIP Number',
        'Commodity Type Description',
        'Instrument Product Service Type Description',
        'Market Where Traded Code',
      ],
    },
    ValidateCyberEventIndicatorsTypeCode: {
      description: 'Other',
      enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '999'],
      type: 'string',
      enumNames: [
        'Command and control IP address',
        'Command and control URL/domain',
        'Malware MD5, Malware SHA-1, or Malware SHA-256',
        'Media Access Control (MAC) Address',
        'Port',
        'Suspicious e-mail address',
        'Suspicious file name',
        'Suspicious IP address',
        'Suspicious URL/domain',
        'Targeted system',
        'Other',
      ],
    },
    ValidateActivityNarrativeSequenceNumber: {
      description:
        'Fifth block of narrative text (character set 16001-17000, if needed)',
      maximum: 2147483647,
      minimum: -2147483648,
      enum: ['1', '2', '3', '4', '5'],
      type: 'integer',
      enumNames: [
        'First block of narrative text (character set 1-4000)',
        'Second block of narrative text (character set 4001-8000, if needed)',
        'Third block of narrative text (character set 8001-12000, if needed)',
        'Fourth block of narrative text (character set 12001-16000, if needed)',
        'Fifth block of narrative text (character set 16001-17000, if needed)',
      ],
    },
  },
}
