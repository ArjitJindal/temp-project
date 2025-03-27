export const FincenJsonSchema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Thu Sep 28 2023 23:07:47 GMT+0530 (India Standard Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    "Schema tag attributes: xmlns='www.fincen.gov/base' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:vc='http://www.w3.org/2007/XMLSchema-versioning' xmlns:fc2='www.fincen.gov/base' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' targetNamespace='www.fincen.gov/base' elementFormDefault='qualified' attributeFormDefault='unqualified' vc:minVersion='1.1'",
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
          title: 'IP address (date)',
          description:
            'This element identifies the date of the activity associated with the reported IP address.',
        },
        ActivityIPAddressTimeStampText: {
          $ref: '#/definitions/ValidateTimeDataOrBlankType',
          title: 'IP address (timestamp)',
          description:
            'This element identifies the UTC time of the first instance of the reported IP address.',
        },
        IPAddressText: {
          $ref: '#/definitions/RestrictString39',
          title: 'IP address (text)',
          description:
            'This element identifies the IP address of the subject’s electronic internet based contact with the financial institution. example, this may be the IP address used to log into the institution’s online banking page or the IP address used to access an institution’s mobile application.',
        },
      },
      type: 'object',
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
    ActivitySupportDocumentType: {
      required: ['OriginalAttachmentFileName'],
      properties: {
        OriginalAttachmentFileName: {
          $ref: '#/definitions/RestrictString150',
          title: 'Attachment file name',
          description:
            'This element declares the attachment file name included with the FinCEN SAR being filed.',
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
          'ui:schema': {
            'ui:subtype': 'FINCEN_NUMBER',
            'ui:maxDigits': 14,
            'ui:allowNegatives': false,
          },
        },
        FilingDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
          title: 'Filing date',
          description:
            'The date in which the FinCEN SAR is being filed electronically through FinCEN’s BSA E-Filing System. The value provided must adhere to the following requirements: 8 numeric characters in the format YYYYMMDD where YYYY = year, MM = month, and DD = day. Single digit days or months must be prefaced by a zero',
        },
        FilingInstitutionNotetoFinCEN: {
          $ref: '#/definitions/RestrictString50',
          title: 'Filing institution note to FinCEN',
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
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'City unknown (indicator)',
          description:
            'This element declares that the city associated with the address of the party is unknown.',
        },
        CountryCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Country unknown (indicator)',
          description:
            'This element declares that country associated with the address of the party is unknown.',
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
          'ui:schema': {
            'ui:subtype': 'COUNTRY_REGION',
            'ui:countryField': 'RawCountryCodeText',
          },
          description:
            'This element identifies the state/territory/province associated with the address of the party when the corresponding country is equal to US (United States), CA (Canada), MX (Mexico), or a U.S. Territory.',
        },
        RawStreetAddress1Text: {
          $ref: '#/definitions/RestrictString100',
          title: 'Street address',
          description:
            'This element identifies the street address of the party.',
        },
        RawZIPCode: {
          $ref: '#/definitions/RawZIPCodeType',
          title: 'ZIP/Postal Code',
          description:
            'This element identifies the ZIP Code or foreign postal code associated with the address of the party.',
        },
        StateCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'State unknown (indicator)',
          description:
            'This element declares that state associated with the address of the party is unknown when the corresponding country is equal to US (United States), CA (Canada), or MX (Mexico).',
        },
        StreetAddressUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Street address unknown (indicator)',
          description:
            'This element declares that the street address of the party is unknown.',
        },
        ZIPCodeUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'ZIP/Postal Code unknown (indicator)',
          description:
            'This element declares that the ZIP Code or foreign postal code associated with the address of the party is unknown.',
        },
      },
      type: 'object',
    },
    AssetsAttributeType: {
      required: ['AssetAttributeTypeID'],
      properties: {
        AssetAttributeDescriptionText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Asset attribute other',
          description:
            'This element provides a description of the reported asset attribute involved in the suspicious activity',
        },
        AssetAttributeTypeID: {
          $ref: '#/definitions/ValidateAssetAttributeTypeIDTypeCode',
          title: 'Asset attribute type (code)',
          description:
            'This element identifies the type/category of asset attribute, specifically whether it is a type of commodity, product/instrument, market where traded, or CUSIP number',
        },
      },
      type: 'object',
    },
    AssetsTableType: {
      required: ['AssetSubtypeID', 'AssetTypeID'],
      properties: {
        AssetSubtypeID: {
          $ref: '#/definitions/ValidateAssetSubtypeIDTypeCode',
          title: 'Asset subtype',
          description:
            'This element identifies the specific type of asset involved in the suspicious activity, such as Bonds/Notes if a product type is involved, or Bank/cashier’s check if an instrument/payment mechanism is involved.',
        },
        AssetTypeID: {
          $ref: '#/definitions/ValidateAssetTypeIDTypeCode',
          title: 'Asset type (code)',
          description:
            'This element identifies the type/category of assets, specifically whether it is associated with a product type or instrument/payment mechanism.',
        },
        OtherAssetSubtypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Asset other',
          description:
            'This element identifies the description of the other type of reported asset subtype.',
        },
      },
      type: 'object',
    },
    CyberEventIndicatorsType: {
      required: ['CyberEventIndicatorsTypeCode', 'EventValueText'],
      properties: {
        CyberEventDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
          title: 'Cyber event (date)',
          description:
            'This element identifies the date of the first instance of the reported cyber event, specifically, when reporting a Command and Control IP address or Suspicious IP Address.',
        },
        CyberEventIndicatorsTypeCode: {
          $ref: '#/definitions/ValidateCyberEventIndicatorsTypeCode',
          title: 'Cyber event indicator type (code)',
          description: 'This element identifies the cyber event indicator type',
        },
        CyberEventTimeStampText: {
          $ref: '#/definitions/ValidateTimeDataOrBlankType',
          title: 'Cyber event (timestamp)',
          description:
            'This element identifies the UTC time of the first instance of the reported cyber event, specifically, when reporting a Command and Control IP address or Suspicious IP Address.',
        },
        CyberEventTypeOtherText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Cyber event other',
          description:
            'This element identifies the description of the other type of reported cyber event.',
        },
        EventValueText: {
          $ref: '#/definitions/RestrictString4000',
          title: 'Cyber event (value)',
          description:
            'This element identifies the event value associated with the reported cyber event',
        },
      },
      type: 'object',
    },
    ElectronicAddressType: {
      'ui:schema': {
        'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
      },
      required: ['ElectronicAddressText', 'ElectronicAddressTypeCode'],
      properties: {
        ElectronicAddressText: {
          $ref: '#/definitions/RestrictString517',
          title: 'Electronic address',
          description:
            'This element identifies the subject`s email address or website URL (Uniform Resource Locator) address.',
        },
        ElectronicAddressTypeCode: {
          $ref: '#/definitions/ValidateElectronicAddressTypeCode',
          title: 'Electronic address type (code)',
          description:
            'This element identifies the type of electronic address recorded for the subject; specifically whether it is an email address or a website URL (Uniform Resource Locator) address.',
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
    PartyAccountAssociationType: {
      required: ['PartyAccountAssociationTypeCode'],
      properties: {
        AccountClosedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Account closed (indicator)',
          description:
            'This element declares that the recorded account is closed.',
        },
        PartyAccountAssociationTypeCode: {
          $ref: '#/definitions/ValidatePartyAccountAssociationCodeType',
          title: 'Party account association type (code)',
          description: 'This element is for FinCEN purposes only.',
        },
      },
      type: 'object',
    },
    PartyAssociationType: {
      required: [],
      properties: {
        AccountantIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Accountant (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Accountant".',
        },
        ActionTakenDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
          title: 'Action date',
          description:
            'This element identifies the date on which the action was taken in the event that the relationship no longer continues between the subject and the institution.',
        },
        AgentIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Agent (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Agent."',
        },
        AppraiserIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Appraiser (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Appraiser." ',
        },
        AttorneyIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Attorney (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Attorney."',
        },
        BorrowerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Borrower (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Borrower."',
        },
        CustomerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Customer (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Customer."',
        },
        DirectorIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Director (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Director." ',
        },
        EmployeeIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Employee (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Employee." ',
        },
        NoRelationshipToInstitutionIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'No relationship to institution (indicator)',
          description:
            'This element declares that the subject has no relationship with any of the financial institutions recorded in the FinCEN SAR.',
        },
        OfficerIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Officer (indicator)',
          description:
            'This element declares that the subject’s relationship to the institution can be described as "Officer." ',
        },
        OtherPartyAssociationTypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Other relationship',
          description:
            'This element declares that the subject`s relationship to the institution is not covered by any of pre-defined options.',
        },
        OtherRelationshipIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Other relationship (indicator)',
          description:
            ' This element describes the other type of relationship between the subject and the institution.',
        },
        OwnerShareholderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Owner or controlling shareholder (indicator)',
          description:
            ' This element declares that the subject’s relationship to the institution can be described as "Owner or controlling shareholder." ',
        },
        RelationshipContinuesIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Relationship continues (indicator)',
          description:
            'This element declares that the status of the subject’s relationship to the institution can be described as "Relationship continues." ',
        },
        ResignedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Resigned (indicator)',
          description:
            'This element declares that the status of the subject’s relationship to the institution can be described as "Resigned." ',
        },
        SubjectRelationshipFinancialInstitutionTINText: {
          $ref: '#/definitions/RestrictString25',
          title: 'Institution TIN',
          description:
            'This element identifies the TIN of the institution recorded in the FinCEN SAR that the subject has a relationship with.',
        },
        SuspendedBarredIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Suspended/Barred (indicator)',
          description:
            'This element declares that the status of the subject’s relationship to the institution can be described as "Suspended/Barred." ',
        },
        TerminatedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Terminated (indicator)',
          description:
            'This element declares that the status of the subject’s relationship to the institution can be described as "Terminated." ',
        },
      },
      type: 'object',
    },
    PartyIdentificationType: {
      required: [],
      properties: {
        IdentificationPresentUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Identification unknown (indicator)',
          description:
            'This element declares that the form of identification used to verify the identity of the subject is unknown',
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
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'TIN unknown (indicator)',
          description:
            'This element declares that the TIN associated with the party is unknown.',
        },
      },
      type: 'object',
    },
    PartyNameType: {
      required: ['PartyNameTypeCode'],
      properties: {
        EntityLastNameUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Entity name or Individual last name unknown (indicator)',
          description:
            'This element declares that the person legal name (if entity) or last name (if individual) is unknown.',
        },
        FirstNameUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Individual first name unknown (indicator)',
          description:
            'This element declares that the first name of the subject is unknown.',
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
    PartyType: {
      required: ['ActivityPartyTypeCode'],
      properties: {
        ActivityPartyTypeCode: {
          $ref: '#/definitions/ValidateActivityPartyCodeType',
          title: 'Party type',
          description:
            'This element identifies the type of party associated with the FinCEN SAR; specifically, the branch where activity occurred.',
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
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Date of birth unknown (indicator)',
          description:
            'This element identifies the date of birth associated with the subject.',
        },
        BothPurchaserSenderPayeeReceiveIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title:
            "Subject's role in suspicious activity (both Purchaser/Sender and Payee/Receiver)",
          description:
            'This element declares that the subject was both a purchaser/sender of the financial instrument(s) or product(s) involved in the suspicious activity and payee/receiver of the instrument(s) or product(s) involved in the suspicious activity.',
        },
        ContactDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
          title: 'LE contact date',
          description:
            'Law enforcement contact date (date). This element identifies the most-recent date the law enforcement agency was contacted about the suspicious activity.',
        },
        FemaleGenderIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Gender (female)',
          description:
            'This element declares that the gender of the subject is female.',
        },
        IndividualBirthDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankTypeDOB',
          title: 'Date of birth',
          description:
            'This element declares that the date of birth associated with the subject is unknown.',
        },
        LossToFinancialAmountText: {
          $ref: '#/definitions/RestrictString15',
          title: 'Loss to financial institution (if applicable)',
          description:
            'This element identifies the dollar amount loss to the financial institution because of the suspicious activity.',
        },
        MaleGenderIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Gender (male)',
          description:
            'This element declares that the gender of the subject is male.',
        },
        NoBranchActivityInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'No branch activity involved',
          description:
            'This element declares that there is no branch location involved in the suspicious activity for the associated financial institution where activity occurred.',
        },
        NoKnownAccountInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'No known account involved',
          description:
            'This element declares that no account related to the subject is involved in the suspicious activity.',
        },
        NonUSFinancialInstitutionIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Non-U.S. financial institution (indicator)',
          description:
            'This element declares that the account is located at a foreign financial institution.',
        },
        PartyAsEntityOrganizationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Check if entity',
          description: ' This element declares that the subject is an entity.',
        },
        PayeeReceiverIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Subject’s role in suspicious activity (Payee/Receiver)',
          description:
            'This element declares that the subject was the payee or receiver of the instrument(s) or product(s).',
        },
        PayLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title:
            'Financial institution’s role in transaction (Paying location)',
          description:
            'This element declares that the customer received payment from the financial institution where activity occurred for the products or instruments recorded in the FinCEN SAR',
        },
        PrimaryRegulatorTypeCode: {
          $ref: '#/definitions/ValidateFederalRegulatorCodeType',
          title: 'Primary regulator type (code)',
          description:
            'This element identifies the primary federal regulator or BSA examiner of the financial institution where activity occurred as well as the filing institution.',
        },
        PurchaserSenderIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Subject’s role in suspicious activity (Purchaser/Sender)',
          description:
            'This element declares that the subject purchased or sent the financial instrument(s) or product(s) involved in the suspicious activity.',
        },
        SellingLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'Selling location (indicator)',
          description:
            'This element declares that the customer purchased at the financial institution where activity occurred the products or instruments recorded in the FinCEN SAR',
        },
        SellingPayingLocationIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title:
            'Financial Institution’s role in transaction: Both Selling and Paying location',
          description:
            'This element declares that the financial institution where activity occurred was both a paying and selling location for the products or instruments recorded in the FinCEN SAR',
        },
        UnknownGenderIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Gender (unknown)',
          description:
            'This element declares that the gender of the subject is unknown.',
        },
      },
      type: 'object',
    },
    PhoneNumberType: {
      'ui:schema': {
        'ui:subtype': 'FINCEN_PHONE_NUMBER',
      },
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
        PhoneNumberTypeCode: {
          $ref: '#/definitions/ValidatePhoneNumberCodeType',
          title: 'Telephone number type (code)',
          description:
            'This element identifies the telephone number type associated with the subject',
        },
      },
      type: 'object',
    },
    SuspiciousActivityClassificationType: {
      required: ['SuspiciousActivitySubtypeID', 'SuspiciousActivityTypeID'],
      properties: {
        OtherSuspiciousActivityTypeText: {
          $ref: '#/definitions/RestrictString50',
          title: 'Suspicious activity other',
          description:
            'This element identifies the other description of the suspicious activity in the event that a type/category of activity applies (i.e. Structuring, Terrorist financing, etc.) but none of the subtype options apply. ',
        },
        SuspiciousActivitySubtypeID: {
          $ref: '#/definitions/ValidateSuspiciousActivitySubtypeID',
          title: 'Suspicious activity subtype (code)',
          description:
            'This element identifies the suspicious activity subtype, such as the specific type of structuring or specific type of gaming activity',
        },
        SuspiciousActivityTypeID: {
          $ref: '#/definitions/ValidateSuspiciousActivityTypeID',
          title: 'Suspicious activity type (code)',
          description:
            'This element identifies the type/category of suspicious activity, such as Structuring, Terrorist financing, Fraud, etc',
        },
      },
      type: 'object',
    },
    SuspiciousActivityType: {
      required: ['SuspiciousActivityFromDateText'],
      properties: {
        AmountUnknownIndicator: {
          $ref: '#/definitions/ValidateHiddenIndicatorType',
          title: 'Amount unknown (indicator)',
          description:
            'This element declares that the total dollar amount involved in the FinCEN SAR for the time period being reported is unknown.',
        },
        CumulativeTotalViolationAmountText: {
          $ref: '#/definitions/RestrictString15',
          title: 'Cumulative amount',
          description:
            'This element identifies the cumulative amount (in whole U.S. dollars) involved in the suspicious activity',
        },
        NoAmountInvolvedIndicator: {
          $ref: '#/definitions/ValidateIndicatorType',
          title: 'No amount involved (indicator).',
          description:
            'This element declares that there is no amount involved in the suspicious activity',
        },
        SuspiciousActivityFromDateText: {
          $ref: '#/definitions/DateYYYYMMDDType',
          title: 'Date or start date of suspicious activity',
          description:
            'This element identifies either the date on which the suspicious activity occurred (in the event that the suspicious activity occurred on a single day) or the earliest date of suspicious activity (in the event that that suspicious activity occurred on multiple days). ',
        },
        SuspiciousActivityToDateText: {
          $ref: '#/definitions/DateYYYYMMDDOrBlankType',
          title:
            'End date of suspicious activity (when different from the start date)',
          description:
            'This element identifies the most recent date of suspicious activity (in the event that that suspicious activity occurred on multiple days).',
        },
        TotalSuspiciousAmountText: {
          $ref: '#/definitions/RestrictString15',
          title: 'Total amount involved',
          description:
            'This element identifies the total amount (in whole U.S. dollars) involved in the suspicious activity for the time period of the report.',
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
          'ui:schema': {
            'ui:subtype': 'FINCEN_NUMBER',
          },
        },
        '@ActivityAttachmentCount': {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
          'ui:schema': {
            'ui:subtype': 'FINCEN_NUMBER',
          },
        },
        '@AttachmentCount': {
          maximum: 9223372036854776000,
          minimum: -9223372036854776000,
          type: 'integer',
          'ui:schema': {
            'ui:subtype': 'FINCEN_NUMBER',
          },
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
            'SuspiciousActivity',
            'ActivityNarrativeInformation',
          ],
          properties: {
            ActivityAssociation: {
              $ref: '#/definitions/ActivityAssociationType',
              title: 'Type of filing',
              description:
                'This element is the container for information about the type of filing associated with the FinCEN SAR.',
            },
            ActivitySupportDocument: {
              $ref: '#/definitions/ActivitySupportDocumentType',
              title: 'Supporting document',
              description:
                'This element is the container for information about the supporting document as an attachment to the FinCEN SAR being filed.',
            },
            Party: {
              items: {
                $ref: '#/definitions/Party',
              },
              maxItems: 1203,
              minItems: 6,
              type: 'array',
              description:
                'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
            },
            SuspiciousActivity: {
              $ref: '#/definitions/SuspiciousActivity',
            },
            ActivityIPAddress: {
              items: {
                $ref: '#/definitions/ActivityIPAddressType',
              },
              maxItems: 99,
              type: 'array',
              title: 'IP Address',
              description:
                'This element is the container for information about IP address involved in the suspicious activity',
            },
            CyberEventIndicators: {
              items: {
                $ref: '#/definitions/CyberEventIndicatorsType',
              },
              maxItems: 99,
              type: 'array',
              title: 'Cyber event',
              description:
                'This element is the container for information about cyber event involved in the suspicious activity',
            },
            Assets: {
              items: {
                $ref: '#/definitions/AssetsTableType',
              },
              maxItems: 31,
              type: 'array',
              title: 'Asset',
              description:
                'This element is the container for information about asset involved in the suspicious activity, specifically the product type, instrument type, and/or payment mechanism.',
            },
            AssetsAttribute: {
              items: {
                $ref: '#/definitions/AssetsAttributeType',
              },
              maxItems: 396,
              type: 'array',
              title: 'Asset Attribute',
              description:
                'This element is the container for information about the asset attribute involved in the suspicious activity, whether it be a type of commodity, product/instrument, market where traded, and/or CUSIP number',
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
          properties: {
            PartyName: {
              items: {
                $ref: '#/definitions/PartyNameType',
              },
              maxItems: 100,
              type: 'array',
              title: 'Party name',
              description:
                'This is the container for information about the name of the party. The party name can be a legal name, doing business as (DBA) name, or also known as (AKA) name depending on the party type identified',
            },
            Address: {
              items: {
                $ref: '#/definitions/AddressType',
              },
              maxItems: 99,
              type: 'array',
              title: 'Address',
              description:
                'This is the container for information about the address of the party.',
            },
            PhoneNumber: {
              items: {
                $ref: '#/definitions/PhoneNumberType',
              },
              maxItems: 99,
              type: 'array',
              title: 'Telephone number',
              description:
                'This is the container for information about the telephone number of the party',
            },
            PartyIdentification: {
              items: {
                $ref: '#/definitions/PartyIdentificationType',
              },
              maxItems: 100,
              type: 'array',
              title: 'Party identification',
              description:
                'This is the container for information about the identification associated with the party.',
            },
            OrganizationClassificationTypeSubtype: {
              items: {
                $ref: '#/definitions/OrganizationClassificationTypeSubtypeType',
              },
              maxItems: 15,
              type: 'array',
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
              items: {
                $ref: '#/definitions/ElectronicAddressType',
              },
              maxItems: 198,
              type: 'array',
              title: 'Electronic address',
              description:
                'This is the container for information about the subject`s e-mail address or website URL (Uniform Resource Locator). ',
            },
            PartyAssociation: {
              items: {
                $ref: '#/definitions/PartyAssociation',
              },
              maxItems: 99,
              type: 'array',
              title: 'Party association',
              description:
                'This is the container for information about the subject`s relationship to the institution recorded in the FinCEN SAR, as well as information about the branch where activity occurred.',
            },
            PartyAccountAssociation: {
              $ref: '#/definitions/PartyAccountAssociation',
              title: 'Party account association',
              description:
                'This is the container element for information about the financial institution and account(s) related to the subject.',
            },
          },
        },
      ],
      description:
        'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
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
              description:
                'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
            },
          },
        },
      ],
      title: 'Party association',
      description:
        'This is the container for information about the subject`s relationship to the institution recorded in the FinCEN SAR, as well as information about the branch where activity occurred.',
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
              description:
                'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
            },
          },
        },
      ],
      title: 'Party account association',
      description:
        'This is the container element for information about the financial institution and account(s) related to the subject.',
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
              items: {
                $ref: '#/definitions/SuspiciousActivityClassificationType',
              },
              maxItems: 99,
              type: 'array',
              title: 'Suspicious activity classification',
              description:
                'This element is the container for information about the specific type of suspicious activity',
            },
          },
        },
      ],
    },
    ValidateIndicatorType: {
      enum: ['Y', ''],
      type: 'string',
      title: 'Indicator',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
      },
    },
    ValidateHiddenIndicatorType: {
      enum: ['Y', ''],
      type: 'string',
      title: 'Indicator',
      'ui:schema': {
        'ui:subtype': 'FINCEN_INDICATOR',
        'ui:hidden': true,
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
      'ui:schema': {
        'ui:subtype': 'FINCEN_NUMBER',
      },
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
    RawZIPCodeType: {
      type: 'string',
      maxLength: 9,
      pattern: '^[a-zA-Z0-9]+$',
    },
  },
}
