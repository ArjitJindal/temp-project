// This mapping is manually curated and extracted from https://bsaefiling.fincen.treas.gov/docs/XMLUserGuide_FinCENSAR.pdf
// (the title/description info is not in the XML schema)

export const AttributeInfos = {
  EFilingPriorDocumentNumber: {
    title: 'Prior report BSA Identifier (number)',
    description:
      'The BSA Identifier (BSA ID) of the previously-filed FinCEN SAR when filing a correction/amendment and/or a continuing activity report. The value provided must adhere to the following requirements: 14-digit numeric BSA ID (if known); 14 consecutive zeros, i.e. “00000000000000” (if the BSA ID is unknown).',
  },
  FilingDateText: {
    title: 'Filing date',
    description:
      'The date in which the FinCEN SAR is being filed electronically through FinCEN’s BSA E-Filing System. The value provided must adhere to the following requirements: 8 numeric characters in the format YYYYMMDD where YYYY = year, MM = month, and DD = day. Single digit days or months must be prefaced by a zero',
  },
  FilingInstitutionNotetoFinCEN: {
    title: 'Filing institution note to FinCEN',
    description:
      'This element allows the filer to alert FinCEN that this FinCEN SAR is being filed in response to a current specific geographic targeting order (GTO) or advisory or other activity. The value provided must adhere to the following requirements: 50 characters or less.',
  },
  ContinuingActivityReportIndicator: {
    title: 'Continuing activity report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed continues reporting on a previously-reported suspicious activity',
  },
  CorrectsAmendsPriorReportIndicator: {
    title: 'Corrects/Amends prior report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed corrects or amends a previously-filed FinCEN SAR',
  },
  InitialReportIndicator: {
    title: 'Initial report (indicator)',
    description:
      'This element declares that the FinCEN SAR being filed is the first report filed on the suspicious activity',
  },
  JointReportIndicator: {
    title: 'Joint report (indicator)',
    description:
      'This element declares that the FinCEN SAR is being filed jointly by two or morefinancial institutions.',
  },
  AdmissionConfessionNoIndicator: {
    title: 'Corroborative statement to filer: No (indicator)',
    description:
      'This element declares that the subject individual has made no corroborative statement to the filer',
  },
  AdmissionConfessionYesIndicator: {
    title: 'Corroborative statement to filer: Yes (indicator)',
    description:
      ' This element declares that the subject individual has made a statement to the filer admitting to involvement in or otherwise substantiating the suspicious activity.',
  },
  AllCriticalSubjectInformationUnavailableIndicator: {
    title: 'All critical subject information unavailable (indicator)',
    description:
      'This element declares that all critical subject information is unavailable',
  },
  BirthDateUnknownIndicator: {
    title: 'Date of birth unknown (indicator)',
    description:
      'This element identifies the date of birth associated with the subject.',
  },
  BothPurchaserSenderPayeeReceiveIndicator: {
    title:
      "Subject's role in suspicious activity (both Purchaser/Sender and Payee/Receiver)",
    description:
      'This element declares that the subject was both a purchaser/sender of the financial instrument(s) or product(s) involved in the suspicious activity and payee/receiver of the instrument(s) or product(s) involved in the suspicious activity.',
  },
  ContactDateText: {
    title: 'LE contact date',
    description:
      'Law enforcement contact date (date). This element identifies the most-recent date the law enforcement agency was contacted about the suspicious activity.',
  },
  FemaleGenderIndicator: {
    title: 'Gender (female)',
    description:
      'This element declares that the gender of the subject is female.',
  },
  IndividualBirthDateText: {
    title: 'Date of birth',
    description:
      'This element declares that the date of birth associated with the subject is unknown.',
  },
  LossToFinancialAmountText: {
    title: 'Loss to financial institution (if applicable)',
    description:
      'This element identifies the dollar amount loss to the financial institution because of the suspicious activity.',
  },
  MaleGenderIndicator: {
    title: 'Gender (male)',
    description:
      'This element declares that the gender of the subject is male.',
  },
  NoBranchActivityInvolvedIndicator: {
    title: 'No branch activity involved',
    description:
      'This element declares that there is no branch location involved in the suspicious activity for the associated financial institution where activity occurred.',
  },
  NoKnownAccountInvolvedIndicator: {
    title: 'No known account involved',
    description:
      'This element declares that no account related to the subject is involved in the suspicious activity.',
  },
  PartyAsEntityOrganizationIndicator: {
    title: 'Check if entity',
    description: ' This element declares that the subject is an entity.',
  },
  PayeeReceiverIndicator: {
    title: 'Subject’s role in suspicious activity (Payee/Receiver)',
    description:
      'This element declares that the subject was the payee or receiver of the instrument(s) or product(s).',
  },
  PayLocationIndicator: {
    title: 'Financial institution’s role in transaction (Paying location)',
    description:
      'This element declares that the customer received payment from the financial institution where activity occurred for the products or instruments recorded in the FinCEN SAR',
  },
  PrimaryRegulatorTypeCode: {
    title: 'Primary regulator type (code)',
    description:
      'This element identifies the primary federal regulator or BSA examiner of the financial institution where activity occurred as well as the filing institution.',
  },
  PurchaserSenderIndicator: {
    title: 'Subject’s role in suspicious activity (Purchaser/Sender)',
    description:
      'This element declares that the subject purchased or sent the financial instrument(s) or product(s) involved in the suspicious activity.',
  },
  SellingLocationIndicator: {
    title: 'Selling location (indicator)',
    description:
      'This element declares that the customer purchased at the financial institution where activity occurred the products or instruments recorded in the FinCEN SAR',
  },
  SellingPayingLocationIndicator: {
    title:
      'Financial Institution’s role in transaction: Both Selling and Paying location',
    description:
      'This element declares that the financial institution where activity occurred was both a paying and selling location for the products or instruments recorded in the FinCEN SAR',
  },
  UnknownGenderIndicator: {
    title: 'Gender (unknown)',
    description:
      'This element declares that the gender of the subject is unknown.',
  },
  PartyName: {
    title: 'Party name',
    description:
      'This is the container for information about the name of the party. The party name can be a legal name, doing business as (DBA) name, or also known as (AKA) name depending on the party type identified',
  },
  EntityLastNameUnknownIndicator: {
    title: 'Entity name or Individual last name unknown (indicator)',
    description:
      'This element declares that the person legal name (if entity) or last name (if individual) is unknown.',
  },
  FirstNameUnknownIndicator: {
    title: 'Individual first name unknown (indicator)',
    description:
      'This element declares that the first name of the subject is unknown.',
  },
  PartyNameTypeCode: {
    title: 'Party name type (code)',
    description:
      'This element identifies the type of name recorded for the party; specifically, legal name, doing business as (DBA) name, or also known as (AKA) name.',
  },
  RawEntityIndividualLastName: {
    title: 'Entity name or Individual last name',
    description:
      'This element identifies the subject`s legal name, whether it be the legal name of the entity or the last name of the individual.',
  },
  RawIndividualFirstName: {
    title: 'First name',
    description: 'This element identifies the first name of the subject.',
  },
  RawIndividualMiddleName: {
    title: 'Middle name',
    description: 'This element identifies the middle name of the subject.',
  },
  RawIndividualNameSuffixText: {
    title: 'Individual suffix name',
    description: 'This element identifies the suffix name of the subject.',
  },
  RawPartyFullName: {
    title: 'Party full name',
    description:
      'This element identifies the full name of the party, whether it be the legal name if the institution, or DBA/AKA name of the institution or individual.',
  },
  Address: {
    title: 'Address',
    description:
      'This is the container for information about the address of the party.',
  },
  CityUnknownIndicator: {
    title: 'City unknown (indicator)',
    description:
      'This element declares that the city associated with the address of the party is unknown.',
  },
  CountryCodeUnknownIndicator: {
    title: 'Country unknown (indicator)',
    description:
      'This element declares that country associated with the address of the party is unknown.',
  },
  RawCityText: {
    title: 'City',
    description:
      'This element identifies the city associated with the address of the party.',
  },
  RawCountryCodeText: {
    title: 'Country (code)',
    'ui:schema': { 'ui:subtype': 'COUNTRY' },
    description:
      'This element identifies the country associated with the party.',
  },
  RawStateCodeText: {
    title: 'State/Territory/Province (code)',
    description:
      'This element identifies the state/territory/province associated with the address of the party when the corresponding country is equal to US (United States), CA (Canada), MX (Mexico), or a U.S. Territory.',
  },
  RawStreetAddress1Text: {
    title: 'Street address',
    description: 'This element identifies the street address of the party.',
  },
  RawZIPCode: {
    title: 'ZIP/Postal Code',
    description:
      'This element identifies the ZIP Code or foreign postal code associated with the address of the party.',
  },
  StateCodeUnknownIndicator: {
    title: 'State unknown (indicator)',
    description:
      'This element declares that state associated with the address of the party is unknown when the corresponding country is equal to US (United States), CA (Canada), or MX (Mexico).',
  },
  StreetAddressUnknownIndicator: {
    title: 'Street address unknown (indicator)',
    description:
      'This element declares that the street address of the party is unknown.',
  },
  ZIPCodeUnknownIndicator: {
    title: 'ZIP/Postal Code unknown (indicator)',
    description:
      'This element declares that the ZIP Code or foreign postal code associated with the address of the party is unknown.',
  },
  PhoneNumber: {
    title: 'Telephone number',
    description:
      'This is the container for information about the telephone number of the party',
  },
  PhoneNumberExtensionText: {
    title: 'Telephone extension',
    description:
      'This element identifies the telephone extension associated with the telephone number of the party (if known)',
  },
  PhoneNumberText: {
    title: 'Telephone number',
    description: 'This element identifies the telephone number of the party.',
  },
  PhoneNumberTypeCode: {
    title: 'Telephone number type (code)',
    description:
      'This element identifies the telephone number type associated with the subject',
  },
  PartyIdentification: {
    title: 'Party identification',
    description:
      'This is the container for information about the identification associated with the party.',
  },
  IdentificationPresentUnknownIndicator: {
    title: 'Identification unknown (indicator)',
    description:
      'This element declares that the form of identification used to verify the identity of the subject is unknown',
  },
  OtherIssuerCountryText: {
    title: 'Identification issuing country (code)',
    description:
      ' This element identifies the country where the identification was issued by (or in) associated with the subject.',
  },
  OtherIssuerStateText: {
    title: 'Identification issuing state (code)',
    description:
      'This element identifies the state where the identification was issued by (or in) associated with the subject',
  },
  OtherPartyIdentificationTypeText: {
    title: 'Identification type other description (text)',
    description:
      'This element identifies the other identification type associated with the party.',
  },
  PartyIdentificationNumberText: {
    title: 'Identification number',
    description:
      'This element identifies the form of identification number associated with the party.',
  },
  PartyIdentificationTypeCode: {
    title: 'Identification type (code)',
    description:
      'This element identifies the type of identification associated with the party.',
  },
  TINUnknownIndicator: {
    title: 'TIN unknown (indicator)',
    description:
      'This element declares that the TIN associated with the party is unknown.',
  },
  OrganizationClassificationTypeSubtype: {
    title: 'Institution type/subtype',
    description:
      'This is the container form information about the type and subtype of institution associated with the party.',
  },
  OrganizationSubtypeID: {
    title: 'Institution subtype (code)',
    description:
      ' This element identifies the specific type of gaming or securities/futures institution',
  },
  OrganizationTypeID: {
    title: 'Institution type (code)',
    description: 'This element identifies the type of institution.',
  },
  OtherOrganizationSubTypeText: {
    title: 'Institution subtype other (description)',
    description:
      'This element identifies the other type of gaming or securities/futures institution.',
  },
  OtherOrganizationTypeText: {
    title: 'Institution type other (description)',
    description:
      'This element identifies the description of the other gaming or securities/futures institution.',
  },
  PartyOccupationBusiness: {
    title: 'Occupation or type of business',
    description:
      'This is the container for information about the occupation or type of business of the subject.',
  },
  NAICSCode: {
    title: 'NAICS Code',
    description:
      'This element identifies the North American Industry Classification System (NAICS) code for the occupation or type of business of the subject.',
  },
  OccupationBusinessText: {
    title: 'Occupation or type of business',
    description:
      'This element identifies the description of the occupation, profession, or type of business of the subject.',
  },
  ElectronicAddress: {
    title: 'Electronic address',
    description:
      'This is the container for information about the subject`s e-mail address or website URL (Uniform Resource Locator). ',
  },
  ElectronicAddressText: {
    title: 'Electronic address',
    description:
      'This element identifies the subject`s email address or website URL (Uniform Resource Locator) address.',
  },
  ElectronicAddressTypeCode: {
    title: 'Electronic address type (code)',
    description:
      'This element identifies the type of electronic address recorded for the subject; specifically whether it is an email address or a website URL (Uniform Resource Locator) address.',
  },
  PartyAssociation: {
    title: 'Party association',
    description:
      'This is the container for information about the subject`s relationship to the institution recorded in the FinCEN SAR, as well as information about the branch where activity occurred.',
  },
  AccountantIndicator: {
    title: 'Accountant (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Accountant".',
  },
  ActionTakenDateText: {
    title: 'Action date',
    description:
      'This element identifies the date on which the action was taken in the event that the relationship no longer continues between the subject and the institution.',
  },
  AgentIndicator: {
    title: 'Agent (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Agent."',
  },
  AppraiserIndicator: {
    title: 'Appraiser (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Appraiser." ',
  },
  AttorneyIndicator: {
    title: 'Attorney (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Attorney."',
  },
  BorrowerIndicator: {
    title: 'Borrower (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Borrower."',
  },
  CustomerIndicator: {
    title: 'Customer (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Customer."',
  },
  DirectorIndicator: {
    title: 'Director (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Director." ',
  },
  EmployeeIndicator: {
    title: 'Employee (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Employee." ',
  },
  NoRelationshipToInstitutionIndicator: {
    title: 'No relationship to institution (indicator)',
    description:
      'This element declares that the subject has no relationship with any of the financial institutions recorded in the FinCEN SAR.',
  },
  OfficerIndicator: {
    title: 'Officer (indicator)',
    description:
      'This element declares that the subject’s relationship to the institution can be described as "Officer." ',
  },
  OtherPartyAssociationTypeText: {
    title: 'Other relationship',
    description:
      'This element declares that the subject`s relationship to the institution is not covered by any of pre-defined options.',
  },
  OtherRelationshipIndicator: {
    title: 'Other relationship (indicator)',
    description:
      ' This element describes the other type of relationship between the subject and the institution.',
  },
  OwnerShareholderIndicator: {
    title: 'Owner or controlling shareholder (indicator)',
    description:
      ' This element declares that the subject’s relationship to the institution can be described as "Owner or controlling shareholder." ',
  },
  RelationshipContinuesIndicator: {
    title: 'Relationship continues (indicator)',
    description:
      'This element declares that the status of the subject’s relationship to the institution can be described as "Relationship continues." ',
  },
  ResignedIndicator: {
    title: 'Resigned (indicator)',
    description:
      'This element declares that the status of the subject’s relationship to the institution can be described as "Resigned." ',
  },
  SubjectRelationshipFinancialInstitutionTINText: {
    title: 'Institution TIN',
    description:
      'This element identifies the TIN of the institution recorded in the FinCEN SAR that the subject has a relationship with.',
  },
  SuspendedBarredIndicator: {
    title: 'Suspended/Barred (indicator)',
    description:
      'This element declares that the status of the subject’s relationship to the institution can be described as "Suspended/Barred." ',
  },
  TerminatedIndicator: {
    title: 'Terminated (indicator)',
    description:
      'This element declares that the status of the subject’s relationship to the institution can be described as "Terminated." ',
  },
  Party: {
    description:
      'This is the container for information about the individual or entity associated with the FinCEN SAR; specifically, the branch location where activity occurred.',
  },
  ActivityPartyTypeCode: {
    title: 'Party type',
    description:
      'This element identifies the type of party associated with the FinCEN SAR; specifically, the branch where activity occurred.',
  },
  PartyAccountAssociation: {
    title: 'Party account association',
    description:
      'This is the container element for information about the financial institution and account(s) related to the subject.',
  },
  PartyAccountAssociationTypeCode: {
    title: 'Party account association type (code)',
    description: 'This element is for FinCEN purposes only.',
  },
  NonUSFinancialInstitutionIndicator: {
    title: 'Non-U.S. financial institution (indicator)',
    description:
      'This element declares that the account is located at a foreign financial institution.',
  },
  Account: {
    title: 'Account',
    description:
      'This is the container for information about the account (held at the corresponding financial institution) involved in the suspicious activity related to the recorded subject.',
  },
  AccountNumberText: {
    title: 'Account number',
    description:
      'This element identifies the account number involved in the suspicious activity related to the recorded subject.',
  },
  AccountClosedIndicator: {
    title: 'Account closed (indicator)',
    description: 'This element declares that the recorded account is closed.',
  },
  AmountUnknownIndicator: {
    title: 'Amount unknown (indicator)',
    description:
      'This element declares that the total dollar amount involved in the FinCEN SAR for the time period being reported is unknown.',
  },
  CumulativeTotalViolationAmountText: {
    title: 'Cumulative amount',
    description:
      'This element identifies the cumulative amount (in whole U.S. dollars) involved in the suspicious activity',
  },
  NoAmountInvolvedIndicator: {
    title: 'No amount involved (indicator).',
    description:
      'This element declares that there is no amount involved in the suspicious activity',
  },
  SuspiciousActivityFromDateText: {
    title: 'Date or start date of suspicious activity',
    description:
      'This element identifies either the date on which the suspicious activity occurred (in the event that the suspicious activity occurred on a single day) or the earliest date of suspicious activity (in the event that that suspicious activity occurred on multiple days). ',
  },
  SuspiciousActivityToDateText: {
    title:
      'End date of suspicious activity (when different from the start date)',
    description:
      'This element identifies the most recent date of suspicious activity (in the event that that suspicious activity occurred on multiple days).',
  },
  TotalSuspiciousAmountText: {
    title: 'Total amount involved',
    description:
      'This element identifies the total amount (in whole U.S. dollars) involved in the suspicious activity for the time period of the report.',
  },
  SuspiciousActivityClassification: {
    title: 'Suspicious activity classification',
    description:
      'This element is the container for information about the specific type of suspicious activity',
  },
  OtherSuspiciousActivityTypeText: {
    title: 'Suspicious activity other',
    description:
      'This element identifies the other description of the suspicious activity in the event that a type/category of activity applies (i.e. Structuring, Terrorist financing, etc.) but none of the subtype options apply. ',
  },
  SuspiciousActivitySubtypeID: {
    title: 'Suspicious activity subtype (code)',
    description:
      'This element identifies the suspicious activity subtype, such as the specific type of structuring or specific type of gaming activity',
  },
  ActivityIPAddress: {
    title: 'IP Address',
    description:
      'This element is the container for information about IP address involved in the suspicious activity',
  },
  ActivityIPAddressDateText: {
    title: 'IP address (date)',
    description:
      'This element identifies the date of the activity associated with the reported IP address.',
  },
  ActivityIPAddressTimeStampText: {
    title: 'IP address (timestamp)',
    description:
      'This element identifies the UTC time of the first instance of the reported IP address.',
  },
  IPAddressText: {
    title: 'IP address (text)',
    description:
      'This element identifies the IP address of the subject’s electronic internet based contact with the financial institution. example, this may be the IP address used to log into the institution’s online banking page or the IP address used to access an institution’s mobile application.',
  },
  CyberEventIndicators: {
    title: 'Cyber event',
    description:
      'This element is the container for information about cyber event involved in the suspicious activity',
  },
  CyberEventDateText: {
    title: 'Cyber event (date)',
    description:
      'This element identifies the date of the first instance of the reported cyber event, specifically, when reporting a Command and Control IP address or Suspicious IP Address.',
  },
  CyberEventIndicatorsTypeCode: {
    title: 'Cyber event indicator type (code)',
    description: 'This element identifies the cyber event indicator type',
  },
  CyberEventTimeStampText: {
    title: 'Cyber event (timestamp)',
    description:
      'This element identifies the UTC time of the first instance of the reported cyber event, specifically, when reporting a Command and Control IP address or Suspicious IP Address.',
  },
  CyberEventTypeOtherText: {
    title: 'Cyber event other',
    description:
      'This element identifies the description of the other type of reported cyber event.',
  },
  EventValueText: {
    title: 'Cyber event (value)',
    description:
      'This element identifies the event value associated with the reported cyber event',
  },
  Assets: {
    title: 'Asset',
    description:
      'This element is the container for information about asset involved in the suspicious activity, specifically the product type, instrument type, and/or payment mechanism.',
  },
  AssetSubtypeID: {
    title: 'Asset subtype',
    description:
      'This element identifies the specific type of asset involved in the suspicious activity, such as Bonds/Notes if a product type is involved, or Bank/cashier’s check if an instrument/payment mechanism is involved.',
  },
  AssetTypeID: {
    title: 'Asset type (code)',
    description:
      'This element identifies the type/category of assets, specifically whether it is associated with a product type or instrument/payment mechanism.',
  },
  OtherAssetSubtypeText: {
    title: 'Asset other',
    description:
      'This element identifies the description of the other type of reported asset subtype.',
  },
  AssetsAttribute: {
    title: 'Asset Attribute',
    description:
      'This element is the container for information about the asset attribute involved in the suspicious activity, whether it be a type of commodity, product/instrument, market where traded, and/or CUSIP number',
  },
  AssetAttributeDescriptionText: {
    title: 'Asset attribute other',
    description:
      'This element provides a description of the reported asset attribute involved in the suspicious activity',
  },
  AssetAttributeTypeID: {
    title: 'Asset attribute type (code)',
    description:
      'This element identifies the type/category of asset attribute, specifically whether it is a type of commodity, product/instrument, market where traded, or CUSIP number',
  },
  ActivityNarrativeInformation: {
    title: 'Narrative',
    description:
      'This element is the container for information about narrative description associated with the FinCEN SAR.',
  },
  ActivityNarrativeSequenceNumber: {
    title: 'Narrative (sequence number)',
    description:
      'This element identifies the sequence in which the narrative text should be constructed in the event that multiple ActivityNarrativeInformation element blocks are needed to record the entire narrative',
  },
  ActivityNarrativeText: {
    title: 'Narrative (description)',
    'ui:schema': { 'ui:subtype': 'NARRATIVE' },
    description:
      'This element records the narrative description associated with the suspicious activity. The narrative must provide a clear, complete, and concise description of the activity, including what was unusual or irregular that caused suspicion. ',
  },
  EFilingBatchXML: {
    title: 'Batch acknowledgement',
    description:
      'This is the container for the contents of the batch acknowledgement file.',
  },
  ActivityAssociation: {
    title: 'Type of filing',
    description:
      'This element is the container for information about the type of filing associated with the FinCEN SAR.',
  },
  ActivitySupportDocument: {
    title: 'Supporting document',
    description:
      'This element is the container for information about the supporting document as an attachment to the FinCEN SAR being filed.',
  },
  OriginalAttachmentFileName: {
    title: 'Attachment file name',
    description:
      'This element declares the attachment file name included with the FinCEN SAR being filed.',
  },
  SuspiciousActivityTypeID: {
    title: 'Suspicious activity type (code)',
    description:
      'This element identifies the type/category of suspicious activity, such as Structuring, Terrorist financing, Fraud, etc',
  },
} as const
