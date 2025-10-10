// This mapping is manually curated and extracted from
// https://data.austrac.gov.au/austrac-xsd-stg/au/common-austrac/smr-schema.html
// (the title/description info is not in the XML schema)
export const AttributeInfos = {
  smrList: {
    title: 'Suspicious matter report list',
    description:
      'Root element containing one or more suspicious matter reports submitted to AUSTRAC.',
  },
  reNumber: {
    title: 'Reporting entity number',
    description:
      'Unique number allocated to a reporting entity when enrolled with AUSTRAC.',
  },
  fileName: {
    title: 'SMR file name',
    description:
      'Name of the XML file containing this set of suspicious matter reports.',
  },
  reportCount: {
    title: 'Number of reports in file',
    description:
      'Total count of suspicious matter reports included in the file.',
  },
  smr: {
    title: 'Suspicious matter report',
    description:
      'Details of a single suspicious matter, including parties, activities, and reasons.',
  },
  header: {
    title: 'Report header',
    description:
      'Administrative and submission handling information for the SMR.',
  },
  reReportRef: {
    title: 'Reporting entity reference',
    description:
      'Internal reference number used by the reporting entity for this report.',
  },
  interceptFlag: {
    title: 'Intercept flag',
    description:
      'Flag to hold report for manual review and attachments before submission.',
  },
  reportingBranch: {
    title: 'Reporting branch information',
    description:
      'Details of the branch, office, or location where the suspicious matter occurred or was detected.',
  },
  smDetails: {
    title: 'Suspicious matter details',
    description:
      'Summary of services related to the suspicious activity and reasons for suspicion.',
  },
  designatedSvc: {
    title: 'Designated service',
    description:
      'Service to which the suspicious matter relates under the AML/CTF Act.',
  },
  designatedSvcProvided: {
    title: 'Designated service provided?',
    description:
      'Indicates if a designated service was provided to the person or organisation.',
  },
  designatedSvcRequested: {
    title: 'Designated service requested?',
    description:
      'Indicates if a designated service was requested from the reporting entity.',
  },
  designatedSvcEnquiry: {
    title: 'Designated service enquiry?',
    description:
      'Indicates if an enquiry was made about a designated service without proceeding.',
  },
  suspReason: {
    title: 'Suspicion reason code',
    description:
      'Predefined code indicating the reason for forming the suspicion.',
  },
  suspReasonOther: {
    title: 'Other reason for suspicion',
    description:
      'Short description of the reason for suspicion when no predefined code applies.',
  },
  grandTotal: {
    title: 'Total value',
    description:
      'Total estimated value involved in the suspicious matter, in Australian dollars.',
  },
  suspPerson: {
    title: 'Suspicious person or organisation',
    description:
      'Details of the main person or organisation to which the suspicious matter relates.',
  },
  otherPerson: {
    title: 'Other related person or organisation',
    description: 'Details of other parties related to the suspicious matter.',
  },
  relationship: {
    title: 'Relationship to suspicious person',
    description:
      'Description of how this party is linked to the suspicious person.',
  },
  evidence: {
    title: 'Evidence of relationship',
    description:
      'Description of documents proving a party’s link to the suspicious person.',
  },
  unidentPerson: {
    title: 'Unidentified person',
    description:
      'Details of individuals whose identity could not be confirmed.',
  },
  descOfPerson: {
    title: 'Description of unidentified person',
    description:
      'Physical or distinctive characteristics of the unidentified person.',
  },
  descOfDocs: {
    title: 'Description of documentation',
    description: 'Documentation held in relation to the unidentified person.',
  },
  prevReported: {
    title: 'Previously reported',
    description:
      'Details of a prior report to AUSTRAC about this person or organisation.',
  },
  prevReportDate: {
    title: 'Previous report date',
    description:
      'Date the previous suspicious matter report was submitted to AUSTRAC.',
  },
  prevReportRef: {
    title: 'Previous report reference',
    description: 'Internal reference to the previous suspicious matter report.',
  },
  otherAusGov: {
    title: 'Other government agency',
    description:
      'Details of another Australian government agency to which this matter was or will be reported.',
  },
  infoProvided: {
    title: 'Information provided',
    description:
      'Summary of information given to the other Australian government agency.',
  },
  additionalDetails: {
    title: 'Additional details',
    description:
      'Most likely offence linked to the matter, plus previous or other agency reports.',
  },
  offence: {
    title: 'Offence type',
    description: 'Most likely offence related to the suspicious matter.',
  },
  txnDetail: {
    title: 'Transaction or activity detail',
    description:
      'Details of a transaction or activity related to the suspicious matter.',
  },
  txnDate: {
    title: 'Transaction date',
    description: 'Date when the suspicious transaction or activity took place.',
  },
  txnType: {
    title: 'Transaction type',
    description: 'Code indicating the nature of the transaction or activity.',
  },
  txnTypeOther: {
    title: 'Other transaction type',
    description:
      'Details for a transaction type not covered by predefined values.',
  },
  txnTypeDesc: {
    title: 'Other transaction description',
    description:
      'Brief description of a transaction type when no predefined value applies.',
  },
  tfrType: {
    title: 'Transfer type',
    description: 'Indicates whether the transfer involved money or property.',
  },
  txnCompleted: {
    title: 'Transaction completed?',
    description: 'Indicates whether the transaction or activity was completed.',
  },
  txnRefNo: {
    title: 'Transaction reference number',
    description: 'Reference number allocated to the transaction.',
  },
  txnAmount: {
    title: 'Total transaction amount',
    description: 'Full value of the transaction in Australian dollars.',
  },
  cashAmount: {
    title: 'Cash amount',
    description:
      'Total physical currency involved in the transaction, in Australian dollars.',
  },
  foreignCurr: {
    title: 'Foreign currency amount',
    description: 'Currency code and amount for each foreign currency involved.',
  },
  digitalCurrency: {
    title: 'Digital currency details',
    description:
      'Details of any digital currency involved, including code, amount, and blockchain transaction ID.',
  },
  senderDrawerIssuer: {
    title: 'Sender/Drawer/Issuer',
    description: 'Details of the source of funds or value in the transaction.',
  },
  payee: {
    title: 'Payee',
    description: 'Details of the entity receiving funds or value.',
  },
  beneficiary: {
    title: 'Beneficiary',
    description:
      'Details of the ultimate party to receive value in the transaction.',
  },
  businessDetails: {
    title: 'Business details',
    description:
      'Information on the organisation’s structure, beneficial owners, office holders, and incorporation country.',
  },
  documentation: {
    title: 'Documentation',
    description: 'Description of relevant documents held.',
  },
  individualDetails: {
    title: 'Individual details',
    description: 'Date of birth and citizenship country or countries.',
  },
  identification: {
    title: 'Identification document',
    description:
      'Details of identification used to verify the person or organisation.',
  },
  electDataSrc: {
    title: 'Electronic data source',
    description: 'Electronic records used to confirm identity.',
  },
  deviceIdentifier: {
    title: 'Device identifier',
    description:
      'Type and unique identifier of device used, such as IP or MAC address.',
  },
  groundsForSuspicion: {
    title: 'Grounds for suspicion',
    description: 'Narrative explaining circumstances leading to the suspicion.',
  },
  AccountAllOptional: {
    title: 'Account (all optional fields)',
    description:
      'Basic details of an account involved in a suspicious transaction or activity where all fields are optional.',
  },
  AccountSMR: {
    title: 'Account (SMR extended)',
    description:
      'Account details extended to include type, signatories, open date, balance, and associated documentation.',
  },
  AddressAllOptional: {
    title: 'Address',
    description:
      'Flexible address format allowing partial or complete address details.',
  },
  AddressNoCountry: {
    title: 'Address without country',
    description:
      'Australian domestic address details where the country is assumed to be Australia.',
  },
  BranchOptAddr: {
    title: 'Branch or location',
    description:
      'Branch, office, outlet, or location details of the reporting entity.',
  },
  CurrencyAmount: {
    title: 'Currency and amount',
    description:
      'A currency code paired with an amount in its native currency.',
  },
  DeviceIdentifier: {
    title: 'Device identifier',
    description: 'Type and unique identifier of a device or system used.',
  },
  DigitalCurrency: {
    title: 'Digital currency detail',
    description:
      'Details of a digital currency, including code, name, units, backing asset, fiat value, and optional blockchain transaction ID.',
  },
  IdentificationType: {
    title: 'Identification type',
    description: 'Specifies type of identification provided.',
  },
  IndustryOccupation: {
    title: 'Industry or occupation',
    description:
      "Codes or descriptions for an individual's occupation or an organisation's industry.",
  },
  InstitutionWithBranch: {
    title: 'Institution with branch',
    description: 'Details of an institution and its branch location.',
  },
  PartyReference: {
    title: 'Party reference',
    description: 'Reference to another party already described in the report.',
  },
  TfrType: {
    title: 'Transfer type',
    description: 'Indicates if the transfer involved money or property.',
  },
  ABN: {
    title: 'Australian business number',
    description:
      'An 11‑digit number issued by the Australian Taxation Office for business identification.',
  },
  ACN: {
    title: 'Australian company number',
    description:
      'A 9‑digit number issued by ASIC to registered companies in Australia.',
  },
  ARBN: {
    title: 'Australian registered body number',
    description:
      'A 9‑digit number issued by ASIC to registered bodies, including foreign companies.',
  },
  AUSTRACDate: {
    title: 'AUSTRAC date',
    description: 'Date value in range 2000‑01‑01 to 2035‑12‑31.',
  },
  AcctBSB: {
    title: 'Bank state branch number',
    description:
      'A 6‑digit number identifying the Australian financial institution branch.',
  },
  AcctNumber: {
    title: 'Account number',
    description: 'An account or policy number.',
  },
  AcctOtherDesc: {
    title: 'Other account type description',
    description:
      'Short description for an account type not covered by predefined types.',
  },
  AcctTitle: {
    title: 'Account title',
    description: 'Name or title associated with the account.',
  },
  Addr: {
    title: 'Street address',
    description: 'Street number and name or post box details.',
  },
  Amount: {
    title: 'Amount',
    description: 'Currency amount in numeric format without currency symbols.',
  },
  BranchId: {
    title: 'Branch identifier',
    description:
      'Identifier for a branch, outlet, office or other location within the reporting entity.',
  },
  BranchName: {
    title: 'Branch name',
    description: 'Name of the branch, outlet or office.',
  },
  BusinessStructure: {
    title: 'Business structure',
    description: 'Code representing the legal structure of a business.',
  },
  Country: {
    title: 'Country name',
    description: "A country's official short name in English (ISO 3166).",
  },
  CurrencyCode: {
    title: 'Currency code',
    description: 'The three‑letter ISO 4217 currency code.',
  },
  DateNoTimeZone: {
    title: 'Date (YYYY‑MM‑DD)',
    description: 'Date in strict YYYY‑MM‑DD format without time zone.',
  },
  DateOfBirth: {
    title: 'Date of birth',
    description: "An individual's date of birth.",
  },
  DecimalNumber: {
    title: 'Number of units',
    description: 'A decimal number with up to 10 fractional digits.',
  },
  DesignatedSvc: {
    title: 'Designated service code',
    description: 'Code identifying a designated service under the AML/CTF Act.',
  },
  DeviceType: {
    title: 'Device type',
    description: 'Predefined type of device identifier.',
  },
  DigitalCurrencyWallet: {
    title: 'Digital currency wallet address',
    description: 'The identifying address of a digital currency wallet.',
  },
  ElectronicDataSource: {
    title: 'Electronic data source',
    description: 'Description of an electronic source used to verify identity.',
  },
  Email: {
    title: 'Email address',
    description: 'An email address in standard local‑part@domain format.',
  },
  IdIssuer: {
    title: 'Identification issuer',
    description:
      'Organisation or government body that issued the identification document.',
  },
  IdNumber: {
    title: 'Identification number',
    description: 'Number on an identification document.',
  },
  IdType: {
    title: 'Identification type',
    description: 'Predefined type of identification document.',
  },
  IndOccCode: {
    title: 'Industry/Occupation code',
    description: 'Code for an industry or occupation using ABS standards.',
  },
  IndOccDesc: {
    title: 'Industry/Occupation description',
    description: 'Text description of an industry or occupation.',
  },
  IndOccType: {
    title: 'Industry/Occupation type',
    description: 'Classification system type for the code provided.',
  },
  InstnCountry: {
    title: 'Institution country',
    description: 'Country where the institution is located.',
  },
  InstnName: {
    title: 'Institution name',
    description: 'Name of the institution.',
  },
  Name: {
    title: 'Name',
    description: 'Full name of an individual or organisation.',
  },
  OffenceType: {
    title: 'Offence type',
    description: 'Most likely offence type related to the suspicious matter.',
  },
  OtherTransactionType: {
    title: 'Other transaction indicator',
    description:
      'Indicator for a transaction type not covered by predefined values.',
  },
  PhoneNum: {
    title: 'Phone number',
    description: 'A contact telephone number.',
  },
  Postcode: {
    title: 'Postcode',
    description: 'Postal or ZIP code.',
  },
  RENumber: {
    title: 'Reporting entity number',
    description: 'Unique AUSTRAC number assigned to a reporting entity.',
  },
  REReportRef: {
    title: 'Reporting entity report reference',
    description: 'Internal reference number for the suspicious matter report.',
  },
  ReportCount: {
    title: 'Report count',
    description: 'Total number of SMRs in the file.',
  },
  SMRAccountType: {
    title: 'Account type',
    description: 'Type of account from a predefined list.',
  },
  SMRDate: {
    title: 'SMR date',
    description: 'Date with extended allowable range used within SMRs.',
  },
  SMRFileName: {
    title: 'SMR file name',
    description:
      'File name of the SMR XML document following AUSTRAC convention.',
  },
  SignedAmount: {
    title: 'Signed amount',
    description: 'Positive or negative currency amount.',
  },
  State: {
    title: 'State or province',
    description: 'Name or abbreviation of a state, province, or territory.',
  },
  Suburb: {
    title: 'Suburb/Town/City',
    description: 'Name of a suburb, town, or city.',
  },
  SuspReason: {
    title: 'Reason code for suspicion',
    description: 'Short code representing the reason a suspicion was formed.',
  },
  TRN: {
    title: 'Transaction reference number',
    description: 'Reference number assigned to the transaction.',
  },
  TransactionType: {
    title: 'Transaction type code',
    description: 'Code for the type of transaction or activity.',
  },
  YesNo: {
    title: 'Yes/No indicator',
    description: 'Indicates Yes or No.',
  },
}
