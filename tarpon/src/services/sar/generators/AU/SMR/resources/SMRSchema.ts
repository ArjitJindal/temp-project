export const AustracJsonSchema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Fri Sep 05 2025 02:11:56 GMT+0530 (India Standard Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    '<d:title xmlns:d="http://docbook.org/ns/docbook">Electronic report file format specification – suspicious matter report (SMR)</d:title> <d:author xmlns:d="http://docbook.org/ns/docbook"> <d:orgname>Australian Transaction Reports and Analysis Centre (AUSTRAC)</d:orgname> <d:uri>http://www.austrac.gov.au/</d:uri> </d:author> <d:revhistory xmlns:d="http://docbook.org/ns/docbook"> <d:revision> <d:revnumber>2.0a</d:revnumber> <d:date>April 2025</d:date> </d:revision> </d:revhistory> <d:copyright xmlns:d="http://docbook.org/ns/docbook"> <d:year>2018</d:year> <d:holder>Commonwealth of Australia</d:holder> </d:copyright> <d:keywordset xmlns:d="http://docbook.org/ns/docbook"> <d:keyword>AUSTRAC</d:keyword> <d:keyword>SMR</d:keyword> <d:keyword>Suspicious matter report</d:keyword> <d:keyword>Report file format</d:keyword> <d:keyword>User guide</d:keyword> <d:keyword>Schema reference</d:keyword> <d:keyword>XSD reference</d:keyword> </d:keywordset>',
  properties: {
    smrList: {
      $ref: '#/definitions/smrList',
      title: 'Suspicious matter report list',
      description:
        'Root element containing one or more suspicious matter reports submitted to AUSTRAC.',
    },
    smr: {
      $ref: '#/definitions/smr',
      title: 'Suspicious matter report',
      description:
        'Details of a single suspicious matter, including parties, activities, and reasons.',
    },
    header: {
      $ref: '#/definitions/header',
      title: 'Report header',
      description:
        'Administrative and submission handling information for the SMR.',
    },
    suspReasons: {
      $ref: '#/definitions/suspReasons',
    },
    smDetails: {
      $ref: '#/definitions/smDetails',
      title: 'Suspicious matter details',
      description:
        'Summary of services related to the suspicious activity and reasons for suspicion.',
    },
    suspPerson: {
      $ref: '#/definitions/suspPerson',
      title: 'Suspicious person or organisation',
      description:
        'Details of the main person or organisation to which the suspicious matter relates.',
    },
    otherPerson: {
      $ref: '#/definitions/otherPerson',
      title: 'Other related person or organisation',
      description: 'Details of other parties related to the suspicious matter.',
    },
    unidentPerson: {
      $ref: '#/definitions/unidentPerson',
      title: 'Unidentified person',
      description:
        'Details of individuals whose identity could not be confirmed.',
    },
    AccountSMR: {
      $ref: '#/definitions/AccountSMR',
      title: 'Account (SMR extended)',
      description:
        'Account details extended to include type, signatories, open date, balance, and associated documentation.',
    },
    accountSuspPerson: {
      $ref: '#/definitions/AccountSMR',
    },
    accountOtherPerson: {
      $ref: '#/definitions/AccountSMR',
    },
    prevReported: {
      $ref: '#/definitions/prevReported',
      title: 'Previously reported',
      description:
        'Details of a prior report to AUSTRAC about this person or organisation.',
    },
    otherAusGov: {
      $ref: '#/definitions/otherAusGov',
      title: 'Other government agency',
      description:
        'Details of another Australian government agency to which this matter was or will be reported.',
    },
    additionalDetails: {
      $ref: '#/definitions/additionalDetails',
      title: 'Additional details',
      description:
        'Most likely offence linked to the matter, plus previous or other agency reports.',
    },
    txnDetail: {
      $ref: '#/definitions/txnDetail',
      title: 'Transaction or activity detail',
      description:
        'Details of a transaction or activity related to the suspicious matter.',
    },
    senderDrawerIssuer: {
      $ref: '#/definitions/senderDrawerIssuer',
      title: 'Sender/Drawer/Issuer',
      description:
        'Details of the source of funds or value in the transaction.',
    },
    payee: {
      $ref: '#/definitions/payee',
      title: 'Payee',
      description: 'Details of the entity receiving funds or value.',
    },
    beneficiary: {
      $ref: '#/definitions/beneficiary',
      title: 'Beneficiary',
      description:
        'Details of the ultimate party to receive value in the transaction.',
    },
    businessDetails: {
      $ref: '#/definitions/businessDetails',
      title: 'Business details',
      description:
        'Information on the organisation’s structure, beneficial owners, office holders, and incorporation country.',
    },
    individualDetails: {
      $ref: '#/definitions/individualDetails',
      title: 'Individual details',
      description: 'Date of birth and citizenship country or countries.',
    },
    identification: {
      $ref: '#/definitions/identification',
      title: 'Identification document',
      description:
        'Details of identification used to verify the person or organisation.',
    },
    suspGrounds: {
      $ref: '#/definitions/suspGrounds',
    },
    SMRAccountType: {
      $ref: '#/definitions/SMRAccountType',
      title: 'Account type',
      description: 'Type of account from a predefined list.',
    },
    DesignatedSvc: {
      $ref: '#/definitions/DesignatedSvc',
      title: 'Designated service code',
      description:
        'Code identifying a designated service under the AML/CTF Act.',
    },
    TransactionType: {
      $ref: '#/definitions/TransactionType',
      title: 'Transaction type code',
      description: 'Code for the type of transaction or activity.',
    },
    OtherTransactionType: {
      $ref: '#/definitions/OtherTransactionType',
      title: 'Other transaction indicator',
      description:
        'Indicator for a transaction type not covered by predefined values.',
    },
    OffenceType: {
      $ref: '#/definitions/OffenceType',
      title: 'Offence type',
      description: 'Most likely offence type related to the suspicious matter.',
    },
    SuspReason: {
      $ref: '#/definitions/SuspReason',
      title: 'Reason code for suspicion',
      description: 'Short code representing the reason a suspicion was formed.',
    },
    RENumber: {
      $ref: '#/definitions/RENumber',
      title: 'Reporting entity number',
      description: 'Unique AUSTRAC number assigned to a reporting entity.',
    },
    IFTIDRAFileName: {
      $ref: '#/definitions/IFTIDRAFileName',
    },
    IFTIEFileName: {
      $ref: '#/definitions/IFTIEFileName',
    },
    SMRFileName: {
      $ref: '#/definitions/SMRFileName',
      title: 'SMR file name',
      description:
        'File name of the SMR XML document following AUSTRAC convention.',
    },
    TTRFBSFileName: {
      $ref: '#/definitions/TTRFBSFileName',
    },
    TTRGSFileName: {
      $ref: '#/definitions/TTRGSFileName',
    },
    TTRISIFileName: {
      $ref: '#/definitions/TTRISIFileName',
    },
    TTRMSBFileName: {
      $ref: '#/definitions/TTRMSBFileName',
    },
    ReportCount: {
      $ref: '#/definitions/ReportCount',
      title: 'Report count',
      description: 'Total number of SMRs in the file.',
    },
    ReportType: {
      $ref: '#/definitions/ReportType',
    },
    Name: {
      $ref: '#/definitions/Name',
      title: 'Name',
      description: 'Full name of an individual or organisation.',
    },
    NameType: {
      $ref: '#/definitions/NameType',
    },
    AddrType: {
      $ref: '#/definitions/AddrType',
    },
    Addr: {
      $ref: '#/definitions/Addr',
      title: 'Street address',
      description: 'Street number and name or post box details.',
    },
    Suburb: {
      $ref: '#/definitions/Suburb',
      title: 'Suburb/Town/City',
      description: 'Name of a suburb, town, or city.',
    },
    State: {
      $ref: '#/definitions/State',
      title: 'State or province',
      description: 'Name or abbreviation of a state, province, or territory.',
    },
    Postcode: {
      $ref: '#/definitions/Postcode',
      title: 'Postcode',
      description: 'Postal or ZIP code.',
    },
    Country: {
      $ref: '#/definitions/Country',
      title: 'Country name',
      description: "A country's official short name in English (ISO 3166).",
    },
    Address: {
      $ref: '#/definitions/Address',
    },
    AddressBasic: {
      $ref: '#/definitions/AddressBasic',
    },
    AddressAllOptional: {
      $ref: '#/definitions/AddressAllOptional',
      title: 'Address',
      description:
        'Flexible address format allowing partial or complete address details.',
    },
    AddressWithType: {
      $ref: '#/definitions/AddressWithType',
    },
    AddressNoCountry: {
      $ref: '#/definitions/AddressNoCountry',
      title: 'Address without country',
      description:
        'Australian domestic address details where the country is assumed to be Australia.',
    },
    AcctType: {
      $ref: '#/definitions/AcctType',
    },
    AcctOtherDesc: {
      $ref: '#/definitions/AcctOtherDesc',
      title: 'Other account type description',
      description:
        'Short description for an account type not covered by predefined types.',
    },
    AcctTitle: {
      $ref: '#/definitions/AcctTitle',
      title: 'Account title',
      description: 'Name or title associated with the account.',
    },
    AcctBSB: {
      $ref: '#/definitions/AcctBSB',
      title: 'Bank state branch number',
      description:
        'A 6‑digit number identifying the Australian financial institution branch.',
    },
    AcctNumber: {
      $ref: '#/definitions/AcctNumber',
      title: 'Account number',
      description: 'An account or policy number.',
    },
    DigitalCurrencyWallet: {
      $ref: '#/definitions/DigitalCurrencyWallet',
      title: 'Digital currency wallet address',
      description: 'The identifying address of a digital currency wallet.',
    },
    AccountOptBSB: {
      $ref: '#/definitions/AccountOptBSB',
    },
    accountOptBSB: {
      $ref: '#/definitions/AccountOptBSB',
    },
    AccountAllOptional: {
      $ref: '#/definitions/AccountAllOptional',
      title: 'Account (all optional fields)',
      description:
        'Basic details of an account involved in a suspicious transaction or activity where all fields are optional.',
    },
    accountAllOptional: {
      $ref: '#/definitions/AccountAllOptional',
    },
    AccountNoBSB: {
      $ref: '#/definitions/AccountNoBSB',
    },
    accountNoBSB: {
      $ref: '#/definitions/AccountNoBSB',
    },
    AccountNoTitle: {
      $ref: '#/definitions/AccountNoTitle',
    },
    AccountBrief: {
      $ref: '#/definitions/AccountBrief',
    },
    accountNoTitle: {
      $ref: '#/definitions/AccountNoTitle',
    },
    IdType: {
      $ref: '#/definitions/IdType',
      title: 'Identification type',
      description: 'Predefined type of identification document.',
    },
    IdTypeGovtIssued: {
      $ref: '#/definitions/IdTypeGovtIssued',
    },
    IdNumber: {
      $ref: '#/definitions/IdNumber',
      title: 'Identification number',
      description: 'Number on an identification document.',
    },
    IdIssuer: {
      $ref: '#/definitions/IdIssuer',
      title: 'Identification issuer',
      description:
        'Organisation or government body that issued the identification document.',
    },
    Identification: {
      $ref: '#/definitions/Identification',
    },
    IdentificationMandatoryNumber: {
      $ref: '#/definitions/IdentificationMandatoryNumber',
    },
    IdentificationNoCountry: {
      $ref: '#/definitions/IdentificationNoCountry',
    },
    Authorisation: {
      $ref: '#/definitions/Authorisation',
    },
    PhoneNum: {
      $ref: '#/definitions/PhoneNum',
      title: 'Phone number',
      description: 'A contact telephone number.',
    },
    Email: {
      $ref: '#/definitions/Email',
      title: 'Email address',
      description: 'An email address in standard local‑part@domain format.',
    },
    TransactionMethod: {
      $ref: '#/definitions/TransactionMethod',
    },
    IndOccDesc: {
      $ref: '#/definitions/IndOccDesc',
      title: 'Industry/Occupation description',
      description: 'Text description of an industry or occupation.',
    },
    IndOccType: {
      $ref: '#/definitions/IndOccType',
      title: 'Industry/Occupation type',
      description: 'Classification system type for the code provided.',
    },
    IndOccCode: {
      $ref: '#/definitions/IndOccCode',
      title: 'Industry/Occupation code',
      description: 'Code for an industry or occupation using ABS standards.',
    },
    IndustryOccupation: {
      $ref: '#/definitions/IndustryOccupation',
      title: 'Industry or occupation',
      description:
        "Codes or descriptions for an individual's occupation or an organisation's industry.",
    },
    ABN: {
      $ref: '#/definitions/ABN',
      title: 'Australian business number',
      description:
        'An 11‑digit number issued by the Australian Taxation Office for business identification.',
    },
    ACN: {
      $ref: '#/definitions/ACN',
      title: 'Australian company number',
      description:
        'A 9‑digit number issued by ASIC to registered companies in Australia.',
    },
    ARBN: {
      $ref: '#/definitions/ARBN',
      title: 'Australian registered body number',
      description:
        'A 9‑digit number issued by ASIC to registered bodies, including foreign companies.',
    },
    CustNumber: {
      $ref: '#/definitions/CustNumber',
    },
    BusinessStructure: {
      $ref: '#/definitions/BusinessStructure',
      title: 'Business structure',
      description: 'Code representing the legal structure of a business.',
    },
    ElectronicDataSource: {
      $ref: '#/definitions/ElectronicDataSource',
      title: 'Electronic data source',
      description:
        'Description of an electronic source used to verify identity.',
    },
    DeviceIdentifier: {
      $ref: '#/definitions/DeviceIdentifier',
      title: 'Device identifier',
      description: 'Type and unique identifier of a device or system used.',
    },
    DeviceType: {
      $ref: '#/definitions/DeviceType',
      title: 'Device type',
      description: 'Predefined type of device identifier.',
    },
    PlaceOfBirth: {
      $ref: '#/definitions/PlaceOfBirth',
    },
    DateNoTimeZone: {
      $ref: '#/definitions/DateNoTimeZone',
      title: 'Date (YYYY‑MM‑DD)',
      description: 'Date in strict YYYY‑MM‑DD format without time zone.',
    },
    AUSTRACDate: {
      $ref: '#/definitions/AUSTRACDate',
      title: 'AUSTRAC date',
      description: 'Date value in range 2000‑01‑01 to 2035‑12‑31.',
    },
    DateOfBirth: {
      $ref: '#/definitions/DateOfBirth',
      title: 'Date of birth',
      description: "An individual's date of birth.",
    },
    SMRDate: {
      $ref: '#/definitions/SMRDate',
      title: 'SMR date',
      description: 'Date with extended allowable range used within SMRs.',
    },
    CurrencyCode: {
      $ref: '#/definitions/CurrencyCode',
      title: 'Currency code',
      description: 'The three‑letter ISO 4217 currency code.',
    },
    SignedAmount: {
      $ref: '#/definitions/SignedAmount',
      title: 'Signed amount',
      description: 'Positive or negative currency amount.',
    },
    Amount: {
      $ref: '#/definitions/Amount',
      title: 'Amount',
      description:
        'Currency amount in numeric format without currency symbols.',
    },
    CurrencyAmount: {
      $ref: '#/definitions/CurrencyAmount',
      title: 'Currency and amount',
      description:
        'A currency code paired with an amount in its native currency.',
    },
    AudAmount: {
      $ref: '#/definitions/AudAmount',
    },
    DecimalNumber: {
      $ref: '#/definitions/DecimalNumber',
      title: 'Number of units',
      description: 'A decimal number with up to 10 fractional digits.',
    },
    InstnCode: {
      $ref: '#/definitions/InstnCode',
    },
    InstnName: {
      $ref: '#/definitions/InstnName',
      title: 'Institution name',
      description: 'Name of the institution.',
    },
    InstnCity: {
      $ref: '#/definitions/InstnCity',
    },
    InstnCountry: {
      $ref: '#/definitions/InstnCountry',
      title: 'Institution country',
      description: 'Country where the institution is located.',
    },
    InstitutionFull: {
      $ref: '#/definitions/InstitutionFull',
    },
    InstitutionBrief: {
      $ref: '#/definitions/InstitutionBrief',
    },
    InstitutionWithAccount: {
      $ref: '#/definitions/InstitutionWithAccount',
    },
    InstitutionWithBranch: {
      $ref: '#/definitions/InstitutionWithBranch',
      title: 'Institution with branch',
      description: 'Details of an institution and its branch location.',
    },
    BranchId: {
      $ref: '#/definitions/BranchId',
      title: 'Branch identifier',
      description:
        'Identifier for a branch, outlet, office or other location within the reporting entity.',
    },
    BranchName: {
      $ref: '#/definitions/BranchName',
      title: 'Branch name',
      description: 'Name of the branch, outlet or office.',
    },
    Branch: {
      $ref: '#/definitions/Branch',
    },
    BranchOptAddr: {
      $ref: '#/definitions/BranchOptAddr',
      title: 'Branch or location',
      description:
        'Branch, office, outlet, or location details of the reporting entity.',
    },
    BranchOptCountry: {
      $ref: '#/definitions/BranchOptCountry',
    },
    AusBranch: {
      $ref: '#/definitions/AusBranch',
    },
    Direction: {
      $ref: '#/definitions/Direction',
    },
    TfrType: {
      $ref: '#/definitions/TfrType',
      title: 'Transfer type',
      description: 'Indicates if the transfer involved money or property.',
    },
    TRN: {
      $ref: '#/definitions/TRN',
      title: 'Transaction reference number',
      description: 'Reference number assigned to the transaction.',
    },
    REReportRef: {
      $ref: '#/definitions/REReportRef',
      title: 'Reporting entity report reference',
      description:
        'Internal reference number for the suspicious matter report.',
    },
    NonCashAmount: {
      $ref: '#/definitions/NonCashAmount',
    },
    NonCashAmountCheque: {
      $ref: '#/definitions/NonCashAmountCheque',
    },
    NonCashAmountChequeOptional: {
      $ref: '#/definitions/NonCashAmountChequeOptional',
    },
    NonCashAmountECurrency: {
      $ref: '#/definitions/NonCashAmountECurrency',
    },
    NonCashAmountOther: {
      $ref: '#/definitions/NonCashAmountOther',
    },
    DrawerName: {
      $ref: '#/definitions/DrawerName',
    },
    PayeeName: {
      $ref: '#/definitions/PayeeName',
    },
    Cheque: {
      $ref: '#/definitions/Cheque',
    },
    ECurrency: {
      $ref: '#/definitions/ECurrency',
    },
    DigitalCurrency: {
      $ref: '#/definitions/DigitalCurrency',
      title: 'Digital currency detail',
      description:
        'Details of a digital currency, including code, name, units, backing asset, fiat value, and optional blockchain transaction ID.',
    },
    PartyReference: {
      $ref: '#/definitions/PartyReference',
      title: 'Party reference',
      description:
        'Reference to another party already described in the report.',
    },
    ReasonForTransfer: {
      $ref: '#/definitions/ReasonForTransfer',
    },
    DetailsOfPayment: {
      $ref: '#/definitions/DetailsOfPayment',
    },
    SenderToReceiverInfo: {
      $ref: '#/definitions/SenderToReceiverInfo',
    },
    OtherDetails: {
      $ref: '#/definitions/OtherDetails',
    },
    YesNo: {
      $ref: '#/definitions/YesNo',
      title: 'Yes/No indicator',
      description: 'Indicates Yes or No.',
    },
  },
  type: 'object',
  definitions: {
    smrList: {
      required: ['reNumber', 'fileName', 'reportCount', 'smr'],
      properties: {
        reNumber: {
          $ref: '#/definitions/RENumber',
          title: 'Reporting entity number',
          description:
            'Unique number allocated to a reporting entity when enrolled with AUSTRAC.',
          name: 'Reporting entity number',
        },
        fileName: {
          $ref: '#/definitions/SMRFileName',
          title: 'Smr file name',
          description:
            'Name of the XML file containing this set of suspicious matter reports.',
          name: 'Smr file name',
        },
        reportCount: {
          $ref: '#/definitions/ReportCount',
          title: 'Number of reports in file',
          description:
            'Total count of suspicious matter reports included in the file.',
          name: 'Number of reports in file',
        },
        smr: {
          items: {
            $ref: '#/definitions/smr',
          },
          type: 'array',
        },
      },
      type: 'object',
      title: 'Suspicious matter report list',
      description:
        'Root element containing one or more suspicious matter reports submitted to AUSTRAC.',
      name: 'Suspicious matter report list',
    },
    smr: {
      required: ['header', 'smDetails', 'suspGrounds', 'additionalDetails'],
      properties: {
        header: {
          $ref: '#/definitions/header',
          title: 'Report header',
          description:
            'Administrative and submission handling information for the SMR.',
          name: 'Report header',
        },
        smDetails: {
          $ref: '#/definitions/smDetails',
          title: 'Suspicious matter details',
          description:
            'Summary of services related to the suspicious activity and reasons for suspicion.',
          name: 'Suspicious matter details',
        },
        suspGrounds: {
          $ref: '#/definitions/suspGrounds',
        },
        suspPerson: {
          items: {
            $ref: '#/definitions/suspPerson',
          },
          type: 'array',
        },
        otherPerson: {
          items: {
            $ref: '#/definitions/otherPerson',
          },
          type: 'array',
        },
        unidentPerson: {
          items: {
            $ref: '#/definitions/unidentPerson',
          },
          type: 'array',
        },
        txnDetail: {
          items: {
            $ref: '#/definitions/txnDetail',
          },
          type: 'array',
        },
        additionalDetails: {
          $ref: '#/definitions/additionalDetails',
          title: 'Additional details',
          description:
            'Most likely offence linked to the matter, plus previous or other agency reports.',
          name: 'Additional details',
        },
      },
      type: 'object',
      title: 'Suspicious matter report',
      description:
        'Details of a single suspicious matter, including parties, activities, and reasons.',
      name: 'Suspicious matter report',
    },
    header: {
      required: ['reportingBranch'],
      properties: {
        reReportRef: {
          $ref: '#/definitions/REReportRef',
          title: 'Reporting entity reference',
          description:
            'Internal reference number used by the reporting entity for this report.',
          name: 'Reporting entity reference',
        },
        interceptFlag: {
          type: 'string',
          title: 'Intercept flag',
          description:
            'Flag to hold report for manual review and attachments before submission.',
          name: 'Intercept flag',
        },
        reportingBranch: {
          $ref: '#/definitions/BranchOptAddr',
          title: 'Reporting branch information',
          description:
            'Details of the branch, office, or location where the suspicious matter occurred or was detected.',
          name: 'Reporting branch information',
        },
      },
      type: 'object',
      title: 'Report header',
      description:
        'Administrative and submission handling information for the SMR.',
      name: 'Report header',
    },
    suspReasons: {
      required: ['suspReason'],
      properties: {
        suspReason: {
          $ref: '#/definitions/SuspReason',
          description:
            'Predefined code indicating the reason for forming the suspicion.',
          title: 'Suspicion reason code',
          name: 'Suspicion reason code',
        },
        suspReasonOther: {
          description:
            'Short description of the reason for suspicion when no predefined code applies.',
          maxLength: 200,
          type: 'string',
          title: 'Other reason for suspicion',
          name: 'Other reason for suspicion',
        },
      },
      type: 'object',
      title: 'Suspicion reason',
      name: 'Suspicion reason',
      description:
        'List the most appropriate reason(s) for the suspicion formed in relation to the matter being reported.',
    },
    smDetails: {
      required: ['designatedSvc', 'suspReasons', 'grandTotal'],
      properties: {
        designatedSvc: {
          items: {
            $ref: '#/definitions/DesignatedSvc',
          },
          maxItems: 26,
          type: 'array',
          title: 'Designated services',
          description:
            'List the designated services to which the suspicious matter relates.',
          name: 'Designated services',
        },
        designatedSvcProvided: {
          $ref: '#/definitions/YesNo',
          title: 'Designated services provided',
          description:
            'Indicate whether a service or product, which is categorised as a designated service, has been provided to a person or organisation to which the suspicious matter relates.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Designated services provided',
        },
        designatedSvcRequested: {
          $ref: '#/definitions/YesNo',
          title: 'Designated services requested',
          description:
            'Indicate whether the person or organisation to which this suspicious matter relates requested the provision of a service or product, which is categorised as a designated service, from the reporting entity',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Designated services requested',
        },
        designatedSvcEnquiry: {
          $ref: '#/definitions/YesNo',
          title: 'Designated services enquiry',
          description:
            'Indicate whether the person or organisation to which this suspicious matter relates enquired about the provision of a service or product, which could be categorised as a designated service. However, the person or organisation and the reporting entity did not proceed further by requesting or providing the service or product respectively.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Designated services enquiry',
        },
        suspReasons: {
          items: {
            $ref: '#/definitions/suspReasons',
          },
          minItems: 1,
          type: 'array',
          title: 'Suspicion reason',
          description:
            'List the most appropriate reason(s) for the suspicion formed in relation to the matter being reported.',
          name: 'Suspicion reason',
        },
        grandTotal: {
          $ref: '#/definitions/Amount',
          title: 'Total value',
          description:
            'Total estimated value involved in the suspicious matter, in Australian dollars.',
          name: 'Total value',
        },
      },
      type: 'object',
      title: 'Suspicious matter details',
      description:
        'Summary of services related to the suspicious activity and reasons for suspicion.',
      name: 'Suspicious matter details',
    },
    suspPerson: {
      properties: {
        fullName: {
          $ref: '#/definitions/Name',
        },
        altName: {
          items: {
            $ref: '#/definitions/Name',
          },
          type: 'array',
          title: 'Alternative name',
          description:
            'Any other name(s) the person or organisation is commonly known by or trades under.',
          name: 'Alternative name',
        },
        mainAddress: {
          $ref: '#/definitions/AddressAllOptional',
          title: 'Main address',
          description:
            "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
          name: 'Main address',
        },
        postalAddress: {
          $ref: '#/definitions/AddressAllOptional',
          title: 'Other address',
          description:
            'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.',
          name: 'Other address',
        },
        phone: {
          items: {
            type: 'object',
            properties: {
              phone: {
                $ref: '#/definitions/PhoneNum',
              },
            },
          },
          type: 'array',
          title: 'Phone numbers',
          description: 'A list of contact telephone numbers.',
          name: 'Phone numbers',
        },
        email: {
          items: {
            type: 'object',
            properties: {
              email: {
                $ref: '#/definitions/Email',
              },
            },
          },
          type: 'array',
          title: 'Email addresses',
          description: 'A list of email addresses.',
          name: 'Email addresses',
        },
        account: {
          items: {
            $ref: '#/definitions/AccountSMR',
          },
          type: 'array',
          title: 'Accounts',
          description: 'A list of accounts.',
          name: 'Accounts',
        },
        digitalCurrencyWallet: {
          items: {
            type: 'object',
            properties: {
              digitalCurrencyWallet: {
                $ref: '#/definitions/DigitalCurrencyWallet',
              },
            },
          },
          type: 'array',
          title: 'Digital currency wallet addresses',
          description:
            'A list of the identifying address of a digital currency wallet.',
          name: 'Digital currency wallet addresses',
        },
        indOcc: {
          $ref: '#/definitions/IndustryOccupation',
        },
        abn: {
          $ref: '#/definitions/ABN',
        },
        acn: {
          $ref: '#/definitions/ACN',
        },
        arbn: {
          $ref: '#/definitions/ARBN',
        },
        businessDetails: {
          $ref: '#/definitions/businessDetails',
          title: 'Business details',
          description:
            'Information on the organisation’s structure, beneficial owners, office holders, and incorporation country.',
          name: 'Business details',
        },
        individualDetails: {
          $ref: '#/definitions/individualDetails',
          title: 'Individual details',
          description: 'Date of birth and citizenship country or countries.',
          name: 'Individual details',
        },
        identification: {
          items: {
            $ref: '#/definitions/identification',
          },
          type: 'array',
          title: 'Identification document',
          description:
            'Details of the documents sighted or used to confirm the identity of a person or organisation.',
          name: 'Identification document',
        },
        electDataSrc: {
          items: {
            $ref: '#/definitions/ElectronicDataSource',
          },
          type: 'array',
          title: 'Electronic data source',
          description:
            'Details of the documents sighted or used to confirm the identity of a person or organisation.',
          name: 'Electronic data source',
        },
        deviceIdentifier: {
          items: {
            $ref: '#/definitions/DeviceIdentifier',
          },
          type: 'array',
          title: 'Device identifier',
          description:
            'The device identifier type and unique identifier of the device or system used, such as an IP address, MAC address, etc.',
          name: 'Device identifier',
        },
        personIsCustomer: {
          $ref: '#/definitions/YesNo',
          title: 'Person is customer',
          description:
            'Indicate whether or not the person or organisation is a customer of the reporting entity.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Person is customer',
        },
      },
      type: 'object',
      title: 'Suspicious person or organisation',
      description:
        'Details of the main person or organisation to which the suspicious matter relates.',
      name: 'Suspicious person or organisation',
    },
    otherPerson: {
      properties: {
        fullName: {
          $ref: '#/definitions/Name',
        },
        altName: {
          items: {
            $ref: '#/definitions/Name',
          },
          type: 'array',
          title: 'Alternative name',
          description:
            'Any other name(s) the person or organisation is commonly known by or trades under.',
          name: 'Alternative name',
        },
        mainAddress: {
          $ref: '#/definitions/AddressAllOptional',
          title: 'Main address',
          description:
            "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
          name: 'Main address',
        },
        postalAddress: {
          $ref: '#/definitions/AddressAllOptional',
          title: 'Other address',
          description:
            'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.',
          name: 'Other address',
        },
        phone: {
          items: {
            type: 'object',
            properties: {
              phone: {
                $ref: '#/definitions/PhoneNum',
              },
            },
          },
          type: 'array',
          title: 'Phone numbers',
          description: 'A list of contact telephone numbers.',
          name: 'Phone numbers',
        },
        email: {
          items: {
            type: 'object',
            properties: {
              email: {
                $ref: '#/definitions/Email',
              },
            },
          },
          type: 'array',
          title: 'Email addresses',
          description: 'A list of email addresses.',
          name: 'Email addresses',
        },
        account: {
          items: {
            $ref: '#/definitions/AccountSMR',
          },
          type: 'array',
          title: 'Accounts',
          description: 'A list of accounts.',
          name: 'Accounts',
        },
        digitalCurrencyWallet: {
          items: {
            type: 'object',
            properties: {
              digitalCurrencyWallet: {
                $ref: '#/definitions/DigitalCurrencyWallet',
              },
            },
          },
          type: 'array',
          title: 'Digital currency wallet addresses',
          description:
            'A list of the identifying address of a digital currency wallet.',
          name: 'Digital currency wallet addresses',
        },
        indOcc: {
          $ref: '#/definitions/IndustryOccupation',
        },
        abn: {
          $ref: '#/definitions/ABN',
        },
        acn: {
          $ref: '#/definitions/ACN',
        },
        arbn: {
          $ref: '#/definitions/ARBN',
        },
        businessDetails: {
          $ref: '#/definitions/businessDetails',
          title: 'Business details',
          description:
            'Information on the organisation’s structure, beneficial owners, office holders, and incorporation country.',
          name: 'Business details',
        },
        individualDetails: {
          $ref: '#/definitions/individualDetails',
          title: 'Individual details',
          description: 'Date of birth and citizenship country or countries.',
          name: 'Individual details',
        },
        identification: {
          items: {
            $ref: '#/definitions/identification',
          },
          type: 'array',
          title: 'Identification document',
          description:
            'Details of the documents sighted or used to confirm the identity of a person or organisation.',
          name: 'Identification document',
        },
        electDataSrc: {
          items: {
            $ref: '#/definitions/ElectronicDataSource',
          },
          type: 'array',
          title: 'Electronic data source',
          description:
            'Details of the documents sighted or used to confirm the identity of a person or organisation.',
          name: 'Electronic data source',
        },
        deviceIdentifier: {
          items: {
            $ref: '#/definitions/DeviceIdentifier',
          },
          type: 'array',
          title: 'Device identifier',
          description:
            'The device identifier type and unique identifier of the device or system used, such as an IP address, MAC address, etc.',
          name: 'Device identifier',
        },
        personIsCustomer: {
          $ref: '#/definitions/YesNo',
          title: 'Person is customer',
          description:
            'Indicate whether or not the person or organisation is a customer of the reporting entity.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Person is customer',
        },
        partyIsCustomer: {
          $ref: '#/definitions/YesNo',
          title: 'Party is customer',
          description:
            'Indicate whether or not the other party is a customer of the reporting entity.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Party is customer',
        },
        partyIsAgent: {
          $ref: '#/definitions/YesNo',
          title: 'Party is agent',
          description:
            'Indicate whether or not the other party is an authorised agent of a person or organisation listed as a suspicious person.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Party is agent',
        },
        relationship: {
          maxLength: 4000,
          type: 'string',
          title: 'Relationship to suspicious person',
          description:
            'Description of how this party is linked to the suspicious person.',
          name: 'Relationship to suspicious person',
        },
        evidence: {
          maxLength: 4000,
          type: 'string',
          title: 'Evidence of relationship',
          description:
            'Description of documents proving a party’s link to the suspicious person.',
          name: 'Evidence of relationship',
        },
      },
      type: 'object',
      title: 'Other related person or organisation',
      description: 'Details of other parties related to the suspicious matter.',
      name: 'Other related person or organisation',
    },
    unidentPerson: {
      required: ['descOfPerson'],
      properties: {
        descOfPerson: {
          maxLength: 4000,
          type: 'string',
          title: 'Description of unidentified person',
          description:
            'Physical or distinctive characteristics of the unidentified person.',
          name: 'Description of unidentified person',
        },
        descOfDocs: {
          title: 'Documentations',
          description:
            'Documentation held in relation to the unidentified person.',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              documentation: {
                maxLength: 4000,
                type: 'string',
                title: 'Description of Documentation',
                description: 'Description of relevant documents held.',
              },
            },
          },
          name: 'Documentations',
        },
      },
      type: 'object',
      title: 'Unidentified person',
      description:
        'Details of individuals whose identity could not be confirmed.',
      name: 'Unidentified person',
    },
    AccountSMR: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/AccountAllOptional',
        },
        {
          required: ['type'],
          properties: {
            type: {
              $ref: '#/definitions/SMRAccountType',
              description:
                "If the value of type is 'OTHERS', then otherDesc must be provided (reason required).",
            },
            otherDesc: {
              $ref: '#/definitions/AcctOtherDesc',
              description: "Required when type is 'OTHERS'.",
            },
            acctSigName: {
              items: {
                type: 'object',
                properties: {
                  acctSigName: {
                    $ref: '#/definitions/Name',
                  },
                },
              },
              type: 'array',
              title: 'Signatories',
              description: 'A list of name of a person or organisation',
              name: 'Signatories',
            },
            acctOpenDate: {
              $ref: '#/definitions/SMRDate',
              title: 'Account open date',
              description:
                'Date with extended allowable range used within SMRs.',
              name: 'Account open date',
            },
            acctBal: {
              $ref: '#/definitions/SignedAmount',
              title: 'Account balance',
              description: 'Positive or negative currency amount.',
              name: 'Account balance',
            },
            documentation: {
              maxLength: 4000,
              type: 'string',
              title: 'Documentation',
              description: 'Description of relevant documents held.',
              name: 'Documentation',
            },
          },
        },
      ],
      title: 'Account (smr extended)',
      description:
        'Account details extended to include type, signatories, open date, balance, and associated documentation.',
      name: 'Account (smr extended)',
    },
    accountSuspPerson: {
      $ref: '#/definitions/AccountSMR',
    },
    accountOtherPerson: {
      $ref: '#/definitions/AccountSMR',
    },
    prevReported: {
      required: ['prevReportDate'],
      properties: {
        prevReportDate: {
          $ref: '#/definitions/AUSTRACDate',
          title: 'Previous report date',
          description:
            'Date the previous suspicious matter report was submitted to AUSTRAC.',
          name: 'Previous report date',
        },
        prevReportRef: {
          $ref: '#/definitions/REReportRef',
          title: 'Previous report reference',
          description:
            'Internal reference to the previous suspicious matter report.',
          name: 'Previous report reference',
        },
      },
      type: 'object',
      title: 'Previous or other agency reports',
      description:
        'List the date and reference number of any previous suspicious matter reports given to AUSTRAC relating to the person(s) or organisation(s) in which the suspicious matter relates.',
      name: 'Previous or other agency reports',
    },
    otherAusGov: {
      required: ['name', 'address', 'dateReported', 'infoProvided'],
      properties: {
        name: {
          $ref: '#/definitions/Name',
        },
        address: {
          $ref: '#/definitions/AddressNoCountry',
        },
        dateReported: {
          $ref: '#/definitions/AUSTRACDate',
        },
        infoProvided: {
          maxLength: 4000,
          type: 'string',
          title: 'Information provided',
          description:
            'Summary of information given to the other Australian government agency.',
          name: 'Information provided',
        },
      },
      type: 'object',
      title: 'Other australian government agency',
      description:
        'List other Australian government bodies the suspicious matter has been or will be reported to.',
      name: 'Other australian government agency',
    },
    additionalDetails: {
      required: ['offence'],
      properties: {
        offence: {
          $ref: '#/definitions/OffenceType',
          title: 'Offence type',
          description: 'Most likely offence related to the suspicious matter.',
          name: 'Offence type',
        },
        prevReported: {
          items: {
            $ref: '#/definitions/prevReported',
          },
          type: 'array',
          title: 'Previous or other agency reports',
          description:
            'List the date and reference number of any previous suspicious matter reports given to AUSTRAC relating to the person(s) or organisation(s) in which the suspicious matter relates.',
          name: 'Previous or other agency reports',
        },
        otherAusGov: {
          items: {
            $ref: '#/definitions/otherAusGov',
          },
          type: 'array',
          title: 'Other australian government agency',
          description:
            'List other Australian government bodies the suspicious matter has been or will be reported to.',
          name: 'Other australian government agency',
        },
      },
      type: 'object',
      title: 'Additional details',
      description:
        'Most likely offence linked to the matter, plus previous or other agency reports.',
      name: 'Additional details',
    },
    txnDetail: {
      required: ['txnDate', 'txnType', 'txnAmount'],
      properties: {
        txnDate: {
          $ref: '#/definitions/AUSTRACDate',
          title: 'Transaction date',
          description:
            'Date when the suspicious transaction or activity took place.',
          name: 'Transaction date',
        },
        txnType: {
          $ref: '#/definitions/TransactionType',
          description: 'Code for the type of transaction or activity.',
          title: 'Transaction type code',
          name: 'Transaction type code',
        },
        txnTypeOther: {
          description:
            'Details for a transaction type not covered by predefined values.',
          maxLength: 200,
          type: 'string',
          title: 'Other transaction type',
          name: 'Other transaction type',
        },
        tfrType: {
          $ref: '#/definitions/TfrType',
          title: 'Transfer type',
          description:
            'Indicates whether the transfer involved money or property.',
          name: 'Transfer type',
        },
        txnCompleted: {
          $ref: '#/definitions/YesNo',
          title: 'Transaction completed',
          description:
            'Indicate whether the transaction or activity was completed.',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
          name: 'Transaction completed',
        },
        txnRefNo: {
          items: {
            $ref: '#/definitions/TRN',
          },
          type: 'array',
          title: 'Transaction reference number',
          description:
            'Any reference number allocated to the transaction or activity by the reporting entity.',
          name: 'Transaction reference number',
        },
        txnAmount: {
          $ref: '#/definitions/Amount',
          title: 'Total transaction amount',
          description: 'Full value of the transaction in Australian dollars.',
          name: 'Total transaction amount',
        },
        cashAmount: {
          $ref: '#/definitions/Amount',
          title: 'Cash amount',
          description:
            'Total physical currency involved in the transaction, in Australian dollars.',
          name: 'Cash amount',
        },
        foreignCurr: {
          items: {
            $ref: '#/definitions/CurrencyAmount',
          },
          type: 'array',
          title: 'Foreign currency',
          description:
            'Currency code and value of any foreign currency involved.',
          name: 'Foreign currency',
        },
        digitalCurrency: {
          items: {
            $ref: '#/definitions/DigitalCurrency',
          },
          type: 'array',
          title: 'Digital currency',
          description:
            'Digital currency code, description, value, backing asset, fiat currency value and blockchain reference of any digital currency involved.',
          name: 'Digital currency',
        },
        senderDrawerIssuer: {
          items: {
            $ref: '#/definitions/senderDrawerIssuer',
          },
          type: 'array',
          title: 'Sender drawer issuer',
          description:
            'Details of the source of the funds involved in a suspicious transaction or activity, if any',
          name: 'Sender drawer issuer',
        },
        payee: {
          items: {
            $ref: '#/definitions/payee',
          },
          type: 'array',
          title: 'Payee',
          description:
            'Details of the destination of the funds in relation to a payee, if any.',
          name: 'Payee',
        },
        beneficiary: {
          items: {
            $ref: '#/definitions/beneficiary',
          },
          type: 'array',
          title: 'Beneficiary',
          description:
            'Details of the destination of the funds in relation to a beneficiary, if any.',
          name: 'Beneficiary',
        },
        otherInstitution: {
          items: {
            $ref: '#/definitions/InstitutionWithBranch',
          },
          type: 'array',
          title: 'Other institution',
          description:
            'Details of any institution other than the sending or receiving institutions involved (i.e. any intermediary institution).',
          name: 'Other institution',
        },
      },
      type: 'object',
      title: 'Transaction or activity detail',
      description:
        'Details of a transaction or activity related to the suspicious matter.',
      name: 'Transaction or activity detail',
    },
    senderDrawerIssuer: {
      properties: {
        sameAsSuspPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is a person or organisation to which this suspicious matter relates.',
          title: 'Same as suspicious person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part C (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as suspicious person',
        },
        sameAsOtherPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is another party involved in this suspicious matter.',
          title: 'Same as other person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part D (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as other person',
        },
        other: {
          properties: {
            fullName: {
              $ref: '#/definitions/Name',
            },
            mainAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Main address',
              description:
                "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
              name: 'Main address',
            },
            postalAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Other address',
              description:
                'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.',
              name: 'Other address',
            },
            phone: {
              $ref: '#/definitions/PhoneNum',
            },
            email: {
              $ref: '#/definitions/Email',
            },
            account: {
              items: {
                $ref: '#/definitions/AccountAllOptional',
              },
              type: 'array',
              title: 'Accounts',
              description: 'A list of accounts.',
              name: 'Accounts',
            },
            digitalCurrencyWallet: {
              items: {
                type: 'object',
                properties: {
                  digitalCurrencyWallet: {
                    $ref: '#/definitions/DigitalCurrencyWallet',
                  },
                },
              },
              type: 'array',
              title: 'Digital currency wallet addresses',
              description:
                'A list of the identifying address of a digital currency wallet.',
              name: 'Digital currency wallet addresses',
            },
          },
          title: 'Other person',
          description:
            'Use this sequence when the sender/drawer/issuer is neither a person or organisation to which this suspicious matter relates or another party involved in this suspicious matter.',
          type: 'object',
          name: 'Other person',
        },
        sendingInstitution: {
          items: {
            $ref: '#/definitions/InstitutionWithBranch',
          },
          type: 'array',
          title: 'Sending institution',
          description:
            'Provide details of any sending institution(s) involved or from where the funds originated.',
          name: 'Sending institution',
        },
      },
      type: 'object',
      title: 'Sender drawer issuer',
      description:
        'Details of the source of the funds involved in a suspicious transaction or activity, if any',
      name: 'Sender drawer issuer',
    },
    payee: {
      properties: {
        sameAsSuspPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is a person or organisation to which this suspicious matter relates.',
          title: 'Same as suspicious person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part C (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as suspicious person',
        },
        sameAsOtherPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is another party involved in this suspicious matter.',
          title: 'Same as other person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part D (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as other person',
        },
        other: {
          properties: {
            fullName: {
              $ref: '#/definitions/Name',
            },
            mainAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Main address',
              description:
                "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
              name: 'Main address',
            },
            postalAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Other address',
              description:
                'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.',
              name: 'Other address',
            },
            phone: {
              $ref: '#/definitions/PhoneNum',
            },
            email: {
              $ref: '#/definitions/Email',
            },
            account: {
              items: {
                $ref: '#/definitions/AccountAllOptional',
              },
              type: 'array',
              title: 'Accounts',
              description: 'A list of accounts.',
              name: 'Accounts',
            },
            digitalCurrencyWallet: {
              items: {
                type: 'object',
                properties: {
                  digitalCurrencyWallet: {
                    $ref: '#/definitions/DigitalCurrencyWallet',
                  },
                },
              },
              type: 'array',
              title: 'Digital currency wallet addresses',
              description:
                'A list of the identifying address of a digital currency wallet.',
              name: 'Digital currency wallet addresses',
            },
          },
          title: 'Other person',
          description:
            'Use this sequence when the sender/drawer/issuer is neither a person or organisation to which this suspicious matter relates or another party involved in this suspicious matter.',
          type: 'object',
          name: 'Other person',
        },
        receivingInstitution: {
          items: {
            $ref: '#/definitions/InstitutionWithBranch',
          },
          type: 'array',
          title: 'Receiving institution',
          description:
            'Provide details of any receiving or destination institutions involved in the suspicious transaction or activity.',
          name: 'Receiving institution',
        },
      },
      type: 'object',
      title: 'Payee',
      description:
        'Details of the destination of the funds in relation to a payee, if any.',
      name: 'Payee',
    },
    beneficiary: {
      properties: {
        sameAsSuspPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is a person or organisation to which this suspicious matter relates.',
          title: 'Same as suspicious person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part C (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as suspicious person',
        },
        sameAsOtherPerson: {
          $ref: '#/definitions/PartyReference',
          description:
            'Use this when the sender/drawer/issuer is another party involved in this suspicious matter.',
          title: 'Same as other person',
          required: ['Reference Id'],
          properties: {
            'Reference Id': {
              title: 'Reference id',
              description:
                'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part D (1 based indexing)',
              type: 'string',
              name: 'Reference id',
            },
          },
          name: 'Same as other person',
        },
        other: {
          properties: {
            fullName: {
              $ref: '#/definitions/Name',
            },
            mainAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Main address',
              description:
                "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
              name: 'Main address',
            },
            postalAddress: {
              $ref: '#/definitions/AddressAllOptional',
              title: 'Other address',
              description:
                'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.',
              name: 'Other address',
            },
            phone: {
              $ref: '#/definitions/PhoneNum',
            },
            email: {
              $ref: '#/definitions/Email',
            },
            account: {
              items: {
                $ref: '#/definitions/AccountAllOptional',
              },
              type: 'array',
              title: 'Accounts',
              description: 'A list of accounts.',
              name: 'Accounts',
            },
            digitalCurrencyWallet: {
              items: {
                type: 'object',
                properties: {
                  digitalCurrencyWallet: {
                    $ref: '#/definitions/DigitalCurrencyWallet',
                  },
                },
              },
              type: 'array',
              title: 'Digital currency wallet addresses',
              description:
                'A list of the identifying address of a digital currency wallet.',
              name: 'Digital currency wallet addresses',
            },
          },
          title: 'Other person',
          description:
            'Use this sequence when the sender/drawer/issuer is neither a person or organisation to which this suspicious matter relates or another party involved in this suspicious matter.',
          type: 'object',
          name: 'Other person',
        },
        receivingInstitution: {
          items: {
            $ref: '#/definitions/InstitutionWithBranch',
          },
          type: 'array',
          title: 'Receiving institution',
          description:
            'Provide details of any receiving or destination institutions involved in the suspicious transaction or activity.',
          name: 'Receiving institution',
        },
      },
      type: 'object',
      title: 'Beneficiary',
      description:
        'Details of the destination of the funds in relation to a beneficiary, if any.',
      name: 'Beneficiary',
    },
    businessDetails: {
      properties: {
        businessStruct: {
          $ref: '#/definitions/BusinessStructure',
        },
        benName: {
          items: {
            type: 'object',
            properties: {
              benName: {
                $ref: '#/definitions/Name',
              },
            },
          },
          type: 'array',
          title: 'Beneficial owners',
          description:
            "List the names of the organisation's beneficial owners.",
          name: 'Beneficial owners',
        },
        holderName: {
          items: {
            type: 'object',
            properties: {
              holderName: {
                $ref: '#/definitions/Name',
              },
            },
          },
          type: 'array',
          title: 'Office holders',
          description: "List the names of the organisation's office holders.",
          name: 'Office holders',
        },
        incorpCountry: {
          $ref: '#/definitions/Country',
        },
        documentation: {
          title: 'Documentations',
          description:
            'Describe any documentation held in relation to this organisation (e.g. articles of association, business cards, business/company registration certificate, trust deeds, etc.).',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              documentation: {
                maxLength: 4000,
                type: 'string',
                title: 'Documentation',
                description: 'Description of relevant documents held.',
              },
            },
          },
          name: 'Documentations',
        },
      },
      type: 'object',
      title: 'Business details',
      description:
        'Information on the organisation’s structure, beneficial owners, office holders, and incorporation country.',
      name: 'Business details',
    },
    individualDetails: {
      properties: {
        dob: {
          $ref: '#/definitions/DateOfBirth',
        },
        citizenCountry: {
          items: {
            type: 'object',
            properties: {
              citizenCountry: {
                $ref: '#/definitions/Country',
              },
            },
          },
          type: 'array',
          title: 'Citizenship countries',
          description:
            'A list of countries the person or organisation is a citizen of.',
          name: 'Citizenship countries',
        },
      },
      type: 'object',
      title: 'Individual details',
      description: 'Date of birth and citizenship country or countries.',
      name: 'Individual details',
    },
    identification: {
      type: 'object',
      allOf: [
        {
          $ref: '#/definitions/Identification',
        },
        {
          properties: {
            idIssueDate: {
              $ref: '#/definitions/SMRDate',
              title: 'Id issue date',
              name: 'Id issue date',
            },
            idExpiryDate: {
              $ref: '#/definitions/SMRDate',
              title: 'Id expiry date',
              name: 'Id expiry date',
            },
          },
        },
      ],
      title: 'Identification document',
      description:
        'Details of the documents sighted or used to confirm the identity of a person or organisation.',
      name: 'Identification document',
    },
    suspGrounds: {
      required: ['groundsForSuspicion'],
      properties: {
        groundsForSuspicion: {
          type: 'string',
          title: 'Grounds for suspicion',
          description:
            'Narrative explaining circumstances leading to the suspicion.',
          name: 'Grounds for suspicion',
        },
      },
      type: 'object',
    },
    SMRAccountType: {
      enum: [
        'BETTING',
        'BULLION',
        'CHEQUE',
        'CREDIT',
        'CUSTODY',
        'FCUR',
        'INS',
        'INVEST',
        'HIRE',
        'LOAN',
        'REMIT',
        'VALCARD',
        'SUPER',
        'TRADE',
        'OTHERS',
      ],
      type: 'string',
      title: 'Account type',
      description: 'Type of account from a predefined list.',
      name: 'Account type',
      enumNames: [
        'Betting account',
        'Bullion account',
        'Cheque or savings account',
        'Credit card account',
        'Custodial account',
        'Foreign currency account',
        'Insurance policy',
        'Investment account',
        'Lease/hire purchase account',
        'Loan or mortgage account',
        'Remittance account',
        'Stored value card account',
        'Superannuation or approved deposit fund account',
        'Trading account',
        'Others',
      ],
    },
    DesignatedSvc: {
      enum: [
        'ACC_DEP',
        'AFSL_ARR',
        'BET_ACC',
        'BULSER',
        'BUS_LOAN',
        'BUS_RSA',
        'CHQACCSS',
        'CRDACCSS',
        'CUR_EXCH',
        'CUST_DEP',
        'DCE',
        'DEBTINST',
        'FIN_EFT',
        'GAMCHSKL',
        'GAM_BETT',
        'GAM_EXCH',
        'GAM_MACH',
        'LEASING',
        'LIFE_INS',
        'PAYORDRS',
        'PAYROLL',
        'PENSIONS',
        'RS',
        'SECURITY',
        'SUPERANN',
        'TRAVLCHQ',
        'VALCARDS',
      ],
      type: 'string',
      title: 'Designated service code',
      description:
        'Code identifying a designated service under the AML/CTF Act.',
      name: 'Designated service code',
      enumNames: [
        'Account and deposit taking services',
        'Australian financial service licence (AFSL) holder arranging a designated service',
        'Betting accounts',
        'Bullion dealing services',
        'Loan services',
        'Retirement savings accounts (RSA)',
        'Chequebook access facilities',
        'Debit card access facilities',
        'Currency exchange services',
        'Custodial or depository services',
        'Digital currency exchange services',
        'Debt instruments',
        'Electronic funds transfers (EFT)',
        'Games of chance or skill',
        'Gambling and betting services',
        'Chips/currency exchange services',
        'Gaming machines',
        'Lease/hire purchase services',
        'Life insurance services',
        'Money/postal orders',
        'Payroll services',
        'Pensions and annuity services',
        'Remittance services (money transfers)',
        'Securities market/investment services',
        'Superannuation/approved deposit funds',
        'Travellers cheque exchange services',
        'Stored value cards',
      ],
    },
    TransactionType: {
      enum: [
        'AN',
        'AD',
        'CW',
        'IV',
        'TV',
        'WV',
        'IQ',
        'EC',
        'IC',
        'CB',
        'ID',
        'CD',
        'IM',
        'CM',
        'DA',
        'DC',
        'IT',
        'IF',
        'EA',
        'DE',
        'DS',
        'DB',
        'EF',
        'SF',
        'PF',
        'ST',
        'PT',
        'SB',
        'PB',
        'LA',
        'LR',
        'LD',
        'HP',
        'IL',
        'AC',
        'BP',
        'RL',
        'RV',
        'IH',
        'CC',
        'BE',
        'BI',
        'WC',
        'MP',
        'SS',
        'PS',
        'TS',
        'TT',
        'DD',
        'AQ',
        'TE',
        'TF',
        'IN',
        'CN',
        'TN',
        'TU',
        'OTHERS',
      ],
      type: 'string',
      title: 'Transaction type code',
      description: 'Code for the type of transaction or activity.',
      name: 'Transaction type code',
      enumNames: [
        'Account opening',
        'Account deposit',
        'Account withdrawal',
        'Issue of stored value card',
        'Top up of stored value card',
        'Withdrawal from stored value card',
        'Issue of cheque',
        'Cash a cheque',
        'Issue of bank cheque',
        'Cash a bank cheque',
        'Issue of bank draft',
        'Cash a bank draft',
        'Issue of money/postal order',
        'Cash a money/postal order',
        'Domestic electronic funds transfer into account',
        'Domestic electronic funds transfer out of account',
        'International funds transfer out of Australia',
        'International funds transfer into Australia',
        'Exchange of Australian dollar (AUD) notes',
        'Exchange of digital currency',
        'Sale of digital currency',
        'Purchase of digital currency',
        'Exchange of foreign currency',
        'Sale of foreign currency',
        'Purchase of foreign currency',
        "Issue of traveller's cheques', 'Purchase of traveller's cheques",
        'Sale of bullion',
        'Purchase of bullion',
        'Loan application',
        'Loan repayment',
        'Loan drawdown',
        'Hire purchase/finance lease payment',
        'Issue of life insurance policy',
        'Accept contribution/premium',
        'Benefit payment/payout',
        'Rollover received from another fund',
        'Rollover to another fund',
        'Issue of chips/tokens',
        'Chips/tokens cash out',
        'Place bet',
        'Buy in to a game',
        'Win payout',
        'Electronic gaming machine payout',
        'Dispose securities',
        'Acquire securities',
        'Facilitate the transfer of securities (on behalf of others)',
        'Facilitate the transfer of securities (on own behalf)',
        'Dispose derivatives/futures',
        'Acquire derivatives/futures',
        'Facilitate the transfer of derivatives/futures (on behalf of others)',
        'Facilitate the transfer of derivatives/futures (on own behalf)',
        'Issue of negotiable debt instrument',
        'Cash a negotiable debt instrument',
        'Facilitate the transfer of negotiable debt instrument (on behalf of others)',
        'Facilitate the transfer of negotiable debt instrument (on own behalf)',
        'Others',
      ],
    },
    OtherTransactionType: {
      enum: ['OI', 'OO'],
      type: 'string',
      title: 'Other transaction indicator',
      description:
        'Indicator for a transaction type not covered by predefined values.',
      name: 'Other transaction indicator',
      enumNames: [
        'Other monetary value received',
        'Other monetary value provided',
      ],
    },
    OffenceType: {
      enum: ['TF', 'ML', 'OG', 'FI', 'PC', 'TE'],
      type: 'string',
      title: 'Offence type',
      description: 'Most likely offence type related to the suspicious matter.',
      name: 'Offence type',
      enumNames: [
        'Financing of terrorism',
        'Money laundering',
        'Offence against a Commonwealth, State or Territory law',
        'Person/agent is not who they claim to be',
        'Proceeds of crime',
        'Tax evasion',
      ],
    },
    SuspReason: {
      required: ['@id'],
      properties: {
        '@id': {
          type: 'string',
        },
      },
      enum: [
        'AF',
        'AT',
        'AV',
        'CI',
        'CC',
        'CR',
        'CF',
        'CL',
        'CB',
        'DW',
        'FN',
        'IR',
        'IC',
        'IF',
        'NS',
        'OW',
        'PH',
        'RI',
        'SS',
        'SC',
        'SB',
        'UN',
        'UA',
        'UF',
        'UG',
        'UU',
        'UC',
        'UX',
        'UT',
        'OTHERS',
      ],
      type: 'string',
      title: 'Reason code for suspicion',
      description: 'Short code representing the reason a suspicion was formed.',
      name: 'Reason code for suspicion',
      enumNames: [
        'Advanced fee/scam',
        'ATM/cheque fraud',
        'Avoiding reporting obligations (also known as structuring)',
        'Corporate/investment fraud',
        'Counterfeit currency',
        'Country/jurisdiction risk',
        'Credit card fraud',
        'Credit/loan facility fraud',
        'Currency not declared at border',
        'Department of Foreign Affairs (DFAT) watch list',
        'False name/identity or documents',
        'Immigration related issue',
        'Inconsistent with customer profile',
        'Internet fraud',
        'National security concern',
        'Other watch list',
        'Phishing',
        'Refusal to show identification',
        'Social security issue',
        'Suspected or known criminal',
        'Suspicious behaviour',
        'Unauthorised account transactions',
        'Unusual account activity',
        'Unusual financial instrument',
        'Unusual gambling activity',
        'Unusual use/exchange of cash',
        'Unusually large cash transaction',
        'Unusually large foreign exchange (FX) transaction',
        'Unusually large transfer',
        'Others',
      ],
    },
    RENumber: {
      pattern: '[0-9]{1,7}',
      type: 'string',
      title: 'Reporting entity number',
      description: 'Unique AUSTRAC number assigned to a reporting entity.',
      name: 'Reporting entity number',
    },
    IFTIDRAFileName: {
      pattern:
        '[iI][fF][tT][iI]\\-[dD][rR][aA]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    IFTIEFileName: {
      pattern:
        '[iI][fF][tT][iI]\\-[eE]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    SMRFileName: {
      pattern:
        '[sS][mM][rR]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
      title: 'Smr file name',
      description:
        'File name of the SMR XML document following AUSTRAC convention.',
      name: 'Smr file name',
    },
    TTRFBSFileName: {
      pattern:
        '[tT][tT][rR]\\-[fF][bB][sS]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    TTRGSFileName: {
      pattern:
        '[tT][tT][rR]\\-[gG][sS]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    TTRISIFileName: {
      pattern:
        '[tT][tT][rR]\\-[iI][sS][iI]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    TTRMSBFileName: {
      pattern:
        '[tT][tT][rR]\\-[mM][sS][bB]20[0-9][0-9](0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])[0-9][0-9]\\.[xX][mM][lL]',
      type: 'string',
    },
    ReportCount: {
      maximum: 999999,
      minimum: 1,
      type: 'integer',
      title: 'Report count',
      description: 'Total number of SMRs in the file.',
      name: 'Report count',
    },
    ReportType: {
      enum: [
        'IFTI-E',
        'IFTI-DRA',
        'TTR-MSB',
        'TTR-GS',
        'TTR-ISI',
        'TTR-FBS',
        'SMR',
      ],
      type: 'string',
    },
    Name: {
      maxLength: 140,
      type: 'string',
      title: 'Name',
      description: 'Full name of an individual or organisation.',
      name: 'Name',
    },
    NameType: {
      enum: ['M', 'A', 'T', 'S', 'B', 'H'],
      type: 'string',
    },
    AddrType: {
      enum: ['M', 'P'],
      type: 'string',
    },
    Addr: {
      maxLength: 140,
      type: 'string',
      title: 'Street address',
      description: 'Street number and name or post box details.',
      name: 'Street address',
    },
    Suburb: {
      maxLength: 35,
      type: 'string',
      title: 'Suburb/town/city',
      description: 'Name of a suburb, town, or city.',
      name: 'Suburb/town/city',
    },
    State: {
      maxLength: 35,
      type: 'string',
      title: 'State or province',
      description: 'Name or abbreviation of a state, province, or territory.',
      name: 'State or province',
    },
    Postcode: {
      maxLength: 15,
      type: 'string',
      title: 'Postcode',
      description: 'Postal or ZIP code.',
      name: 'Postcode',
    },
    Country: {
      maxLength: 35,
      type: 'string',
      title: 'Country name',
      description: "A country's official short name in English (ISO 3166).",
      'ui:schema': {
        'ui:subtype': 'COUNTRY',
      },
      name: 'Country name',
    },
    Address: {
      required: ['addr', 'suburb', 'country'],
      properties: {
        addr: {
          $ref: '#/definitions/Addr',
        },
        suburb: {
          $ref: '#/definitions/Suburb',
        },
        state: {
          $ref: '#/definitions/State',
        },
        postcode: {
          $ref: '#/definitions/Postcode',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    AddressBasic: {
      required: ['addr'],
      properties: {
        addr: {
          $ref: '#/definitions/Addr',
        },
        suburb: {
          $ref: '#/definitions/Suburb',
        },
        state: {
          $ref: '#/definitions/State',
        },
        postcode: {
          $ref: '#/definitions/Postcode',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    AddressAllOptional: {
      properties: {
        addr: {
          $ref: '#/definitions/Addr',
        },
        suburb: {
          $ref: '#/definitions/Suburb',
        },
        state: {
          $ref: '#/definitions/State',
        },
        postcode: {
          $ref: '#/definitions/Postcode',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
      title: 'Address',
      description:
        'Flexible address format allowing partial or complete address details.',
      name: 'Address',
    },
    AddressWithType: {
      required: ['type', 'addr', 'country'],
      properties: {
        type: {
          $ref: '#/definitions/AddrType',
        },
        addr: {
          $ref: '#/definitions/Addr',
        },
        suburb: {
          $ref: '#/definitions/Suburb',
        },
        state: {
          $ref: '#/definitions/State',
        },
        postcode: {
          $ref: '#/definitions/Postcode',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    AddressNoCountry: {
      required: ['addr', 'suburb', 'state', 'postcode'],
      properties: {
        addr: {
          $ref: '#/definitions/Addr',
        },
        suburb: {
          $ref: '#/definitions/Suburb',
        },
        state: {
          $ref: '#/definitions/State',
        },
        postcode: {
          $ref: '#/definitions/Postcode',
        },
      },
      type: 'object',
      title: 'Address without country',
      description:
        'Australian domestic address details where the country is assumed to be Australia.',
      name: 'Address without country',
    },
    AcctType: {
      enum: [
        'BETTING',
        'BULLION',
        'CHEQUE',
        'CREDIT',
        'CUSTODY',
        'ECUR',
        'FCUR',
        'INS',
        'INVEST',
        'HIRE',
        'LOAN',
        'OTHERS',
        'PENSION',
        'REMIT',
        'RETIRE',
        'VALCARD',
        'SUPER',
        'TRADE',
      ],
      type: 'string',
    },
    AcctOtherDesc: {
      maxLength: 20,
      type: 'string',
      title: 'Other account type description',
      description:
        'Short description for an account type not covered by predefined types.',
      name: 'Other account type description',
    },
    AcctTitle: {
      maxLength: 140,
      type: 'string',
      title: 'Account title',
      description: 'Name or title associated with the account.',
      name: 'Account title',
    },
    AcctBSB: {
      pattern: '[0-9]{6}',
      type: 'string',
      title: 'Bank state branch number',
      description:
        'A 6‑digit number identifying the Australian financial institution branch.',
      name: 'Bank state branch number',
    },
    AcctNumber: {
      maxLength: 34,
      type: 'string',
      title: 'Account number',
      description: 'An account or policy number.',
      name: 'Account number',
    },
    DigitalCurrencyWallet: {
      pattern: '[0-9a-zA-Z]{0,1024}',
      type: 'string',
      title: 'Digital currency wallet address',
      description: 'The identifying address of a digital currency wallet.',
      name: 'Digital currency wallet address',
    },
    AccountOptBSB: {
      required: ['title', 'number'],
      properties: {
        title: {
          $ref: '#/definitions/AcctTitle',
        },
        bsb: {
          $ref: '#/definitions/AcctBSB',
        },
        number: {
          $ref: '#/definitions/AcctNumber',
        },
      },
      type: 'object',
    },
    accountOptBSB: {
      $ref: '#/definitions/AccountOptBSB',
    },
    AccountAllOptional: {
      properties: {
        title: {
          $ref: '#/definitions/AcctTitle',
        },
        bsb: {
          $ref: '#/definitions/AcctBSB',
        },
        number: {
          $ref: '#/definitions/AcctNumber',
        },
      },
      type: 'object',
      title: 'Account (all optional fields)',
      description:
        'Basic details of an account involved in a suspicious transaction or activity where all fields are optional.',
      name: 'Account (all optional fields)',
    },
    accountAllOptional: {
      $ref: '#/definitions/AccountAllOptional',
    },
    AccountNoBSB: {
      required: ['title', 'number'],
      properties: {
        title: {
          $ref: '#/definitions/AcctTitle',
        },
        number: {
          $ref: '#/definitions/AcctNumber',
        },
      },
      type: 'object',
    },
    accountNoBSB: {
      $ref: '#/definitions/AccountNoBSB',
    },
    AccountNoTitle: {
      required: ['number'],
      properties: {
        bsb: {
          $ref: '#/definitions/AcctBSB',
        },
        number: {
          $ref: '#/definitions/AcctNumber',
        },
      },
      type: 'object',
    },
    AccountBrief: {
      properties: {
        bsb: {
          $ref: '#/definitions/AcctBSB',
        },
        number: {
          $ref: '#/definitions/AcctNumber',
        },
      },
      type: 'object',
    },
    accountNoTitle: {
      $ref: '#/definitions/AccountNoTitle',
    },
    IdType: {
      enum: [
        'A',
        'C',
        'D',
        'P',
        'T',
        'ARNU',
        'CUST',
        'BENE',
        'BCNO',
        'BUSR',
        'EMID',
        'EMPL',
        'IDNT',
        'MEMB',
        'PHOT',
        'SECU',
        'SOID',
        'SOSE',
        'STUD',
        'TXID',
        'OTHERS',
      ],
      type: 'string',
      title: 'Identification type',
      description: 'Predefined type of identification document.',
      name: 'Identification type',
      enumNames: [
        'Bank account',
        'Credit card/debit card',
        'Driver’s licence',
        'Passport',
        'Telephone/fax number',
        'Alien registration number',
        'Customer account/ID',
        'Benefits card/ID',
        'Birth certificate',
        'Business registration/licence',
        'Employee number',
        'Employer number',
        'Identity card/number',
        'Membership ID',
        'Photo ID',
        'Security ID',
        'Social media account/user name',
        'Social security ID',
        'Student',
        'Tax number/ID',
        'Others',
      ],
    },
    IdTypeGovtIssued: {
      allOf: [
        {
          $ref: '#/definitions/IdType',
        },
        {
          enum: ['P', 'ARNU', 'BCNO', 'IDNT', 'SOSE', 'TXID'],
        },
      ],
    },
    IdNumber: {
      maxLength: 20,
      type: 'string',
      title: 'Identification number',
      description: 'Number on an identification document.',
      name: 'Identification number',
    },
    IdIssuer: {
      maxLength: 100,
      type: 'string',
      title: 'Identification issuer',
      description:
        'Organisation or government body that issued the identification document.',
      name: 'Identification issuer',
    },
    Identification: {
      required: ['type'],
      properties: {
        type: {
          $ref: '#/definitions/IdType',
          description:
            "If the value of type is 'OTHERS', then typeOther must be provided (reason required).",
        },
        typeOther: {
          description: "Required when type is 'OTHERS'.",
          maxLength: 30,
          type: 'string',
          title: 'Other description',
          name: 'Other description',
        },
        number: {
          $ref: '#/definitions/IdNumber',
        },
        issuer: {
          $ref: '#/definitions/IdIssuer',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    IdentificationMandatoryNumber: {
      required: ['type', 'number'],
      properties: {
        type: {
          $ref: '#/definitions/IdType',
          description:
            "If the value of type is 'OTHERS', then typeOther must be provided (reason required).",
        },
        typeOther: {
          description: "Required when type is 'OTHERS'.",
          maxLength: 30,
          type: 'string',
          title: 'Other description',
          name: 'Other description',
        },
        number: {
          $ref: '#/definitions/IdNumber',
        },
        issuer: {
          $ref: '#/definitions/IdIssuer',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    IdentificationNoCountry: {
      required: ['type'],
      properties: {
        type: {
          $ref: '#/definitions/IdType',
          description:
            "If the value of type is 'OTHERS', then typeOther must be provided (reason required).",
        },
        typeOther: {
          description: "Required when type is 'OTHERS'.",
          maxLength: 30,
          type: 'string',
          title: 'Other description',
          name: 'Other description',
        },
        number: {
          $ref: '#/definitions/IdNumber',
        },
        issuer: {
          $ref: '#/definitions/IdIssuer',
        },
      },
      type: 'object',
    },
    Authorisation: {
      properties: {
        '@refId': {
          type: 'string',
        },
      },
      type: 'string',
    },
    PhoneNum: {
      maxLength: 20,
      type: 'string',
      title: 'Phone number',
      description: 'A contact telephone number.',
      name: 'Phone number',
    },
    Email: {
      maxLength: 250,
      pattern: '[^@]+@[^@]+',
      type: 'string',
      title: 'Email address',
      description: 'An email address in standard local‑part@domain format.',
      name: 'Email address',
    },
    TransactionMethod: {
      enum: ['ARMOURED_CAR_SERVICE', 'ATM_DEPOSIT', 'NIGHT_QUICK_DEPOSIT'],
      type: 'string',
    },
    IndOccDesc: {
      maxLength: 150,
      type: 'string',
      title: 'Industry/occupation description',
      description: 'Text description of an industry or occupation.',
      name: 'Industry/occupation description',
    },
    IndOccType: {
      enum: ['I', 'M', 'O', 'S', 'OTHERS'],
      type: 'string',
      title: 'Industry/occupation type',
      description: 'Classification system type for the code provided.',
      name: 'Industry/occupation type',
      enumNames: [
        'Australian standard industry code ASIC',
        'Australian New Zealand Standard Industrial Classification ANZSIC',
        'Australian Standard Classification of Occupations ASCO version I',
        'ASCO version II',
        'Others',
      ],
    },
    IndOccCode: {
      type: 'string',
      title: 'Industry/occupation code',
      description: 'Code for the type of individual occupation.',
      name: 'Industry/occupation code',
    },
    IndustryOccupation: {
      required: ['type'],
      properties: {
        type: {
          $ref: '#/definitions/IndOccType',
          description:
            "When 'type' is present, 'code' must also be present. Mutually exclusive: Either (type + code) OR description is allowed.",
        },
        code: {
          $ref: '#/definitions/IndOccCode',
          description: "Required when 'type' is not other.",
        },
        description: {
          $ref: '#/definitions/IndOccDesc',
          description: "Required if 'type' is 'OTHERS'.",
        },
      },
      type: 'object',
      title: 'Industry or occupation',
      description:
        "Codes or descriptions for an individual's occupation or an organisation's industry.",
      name: 'Industry or occupation',
    },
    ABN: {
      pattern: '[0-9]{11}',
      type: 'string',
      title: 'Australian business number',
      description:
        'An 11‑digit number issued by the Australian Taxation Office for business identification.',
      name: 'Australian business number',
    },
    ACN: {
      pattern: '[0-9]{9}',
      type: 'string',
      title: 'Australian company number',
      description:
        'A 9‑digit number issued by ASIC to registered companies in Australia.',
      name: 'Australian company number',
    },
    ARBN: {
      pattern: '[0-9]{9}',
      type: 'string',
      title: 'Australian registered body number',
      description:
        'A 9‑digit number issued by ASIC to registered bodies, including foreign companies.',
      name: 'Australian registered body number',
    },
    CustNumber: {
      maxLength: 35,
      type: 'string',
    },
    BusinessStructure: {
      enum: ['A', 'C', 'G', 'P', 'R', 'T'],
      type: 'string',
      title: 'Business structure',
      description: 'Code representing the legal structure of a business.',
      name: 'Business structure',
      enumNames: [
        'Association',
        'Company',
        'Government Body',
        'Partnership',
        'Registered Body',
        'Trust',
      ],
    },
    ElectronicDataSource: {
      maxLength: 70,
      type: 'string',
      title: 'Electronic data source',
      description:
        'Description of an electronic source used to verify identity.',
      name: 'Electronic data source',
    },
    DeviceIdentifier: {
      required: ['type', 'identifier'],
      properties: {
        type: {
          $ref: '#/definitions/DeviceType',
          description:
            "If the value of type is 'OTHERS', then typeOther must be provided (reason required).",
        },
        typeOther: {
          description: "Required when type is 'OTHERS'.",
          maxLength: 30,
          type: 'string',
          title: 'Other description',
          name: 'Other description',
        },
        identifier: {
          $ref: '#/definitions/IdNumber',
        },
      },
      type: 'object',
      title: 'Device identifier',
      description: 'Type and unique identifier of a device or system used.',
      name: 'Device identifier',
    },
    DeviceType: {
      enum: ['IMEI', 'IMSI', 'IP', 'MAC', 'SEID', 'OTHERS'],
      type: 'string',
      title: 'Device type',
      description: 'Predefined type of device identifier.',
      name: 'Device type',
      enumNames: [
        'International Mobile Equipment Identity',
        'International Mobile Subscriber Identity',
        'Internet Protocol address',
        'Media Access Control address',
        'Secure element ID',
        'Others',
      ],
    },
    PlaceOfBirth: {
      properties: {
        town: {
          $ref: '#/definitions/Suburb',
        },
        country: {
          $ref: '#/definitions/Country',
        },
      },
      type: 'object',
    },
    DateNoTimeZone: {
      pattern: '[0-9]{4}\\-[0-9]{2}\\-[0-9]{2}',
      type: 'string',
      title: 'Date (yyyy‑mm‑dd)',
      description: 'Date in strict YYYY‑MM‑DD format without time zone.',
      name: 'Date (yyyy‑mm‑dd)',
    },
    AUSTRACDate: {
      pattern:
        '(20[0-2][0-9]|203[0-5])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])',
      type: 'string',
      title: 'Austrac date',
      description: 'Date value in range 2000‑01‑01 to 2035‑12‑31.',
      name: 'Austrac date',
    },
    DateOfBirth: {
      pattern:
        '(18[7-9][0-9]|19[0-9]{2}|20[0-2][0-9]|203[0-5])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])',
      type: 'string',
      title: 'Date of birth',
      description: "An individual's date of birth.",
      name: 'Date of birth',
    },
    SMRDate: {
      pattern:
        '(18[0-9]{2}|19[0-9]{2}|20[0-9]{2}|2099)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])',
      type: 'string',
      title: 'Smr date',
      description: 'Date with extended allowable range used within SMRs.',
      name: 'Smr date',
    },
    CurrencyCode: {
      maxLength: 3,
      minLength: 3,
      type: 'string',
      title: 'Currency code',
      description: 'The three‑letter ISO 4217 currency code.',
      name: 'Currency code',
    },
    SignedAmount: {
      type: 'string',
      title: 'Signed amount',
      description: 'Positive or negative currency amount.',
      name: 'Signed amount',
    },
    Amount: {
      type: 'string',
      title: 'Amount',
      description:
        'Currency amount in numeric format without currency symbols.',
      name: 'Amount',
    },
    CurrencyAmount: {
      required: ['currency', 'amount'],
      properties: {
        currency: {
          $ref: '#/definitions/CurrencyCode',
        },
        amount: {
          $ref: '#/definitions/Amount',
        },
      },
      type: 'object',
      title: 'Currency and amount',
      description:
        'A currency code paired with an amount in its native currency.',
      name: 'Currency and amount',
    },
    AudAmount: {
      required: ['currency', 'amount'],
      properties: {
        currency: {
          $ref: '#/definitions/CurrencyCode',
        },
        amount: {
          $ref: '#/definitions/Amount',
        },
      },
      type: 'object',
    },
    DecimalNumber: {
      type: 'string',
      title: 'Number of units',
      description: 'A decimal number with up to 10 fractional digits.',
      name: 'Number of units',
    },
    InstnCode: {
      maxLength: 12,
      type: 'string',
    },
    InstnName: {
      maxLength: 35,
      type: 'string',
      title: 'Institution name',
      description: 'Name of the institution.',
      name: 'Institution name',
    },
    InstnCity: {
      maxLength: 35,
      type: 'string',
    },
    InstnCountry: {
      maxLength: 35,
      type: 'string',
      title: 'Institution country',
      description: 'Country where the institution is located.',
      name: 'Institution country',
    },
    InstitutionFull: {
      required: ['code', 'name', 'addr', 'acctNumber', 'branchId'],
      properties: {
        code: {
          $ref: '#/definitions/InstnCode',
        },
        name: {
          $ref: '#/definitions/InstnName',
        },
        addr: {
          $ref: '#/definitions/Addr',
        },
        acctNumber: {
          $ref: '#/definitions/AcctNumber',
        },
        branchId: {
          $ref: '#/definitions/BranchId',
        },
      },
      type: 'object',
    },
    InstitutionBrief: {
      properties: {
        code: {
          $ref: '#/definitions/InstnCode',
          description:
            "Mutually exclusive: Either 'code' OR ('name', 'city', 'country') may be provided, but not both options together.",
        },
        name: {
          $ref: '#/definitions/InstnName',
          description: "May only be provided when 'code' is absent.",
        },
        city: {
          $ref: '#/definitions/InstnCity',
          description: "May only be provided when 'code' is absent.",
        },
        country: {
          $ref: '#/definitions/InstnCountry',
          description: "May only be provided when 'code' is absent.",
        },
      },
      type: 'object',
    },
    InstitutionWithAccount: {
      required: ['name', 'city'],
      properties: {
        acctNumber: {
          $ref: '#/definitions/AcctNumber',
        },
        name: {
          $ref: '#/definitions/InstnName',
        },
        city: {
          $ref: '#/definitions/InstnCity',
        },
        country: {
          $ref: '#/definitions/InstnCountry',
        },
      },
      type: 'object',
    },
    InstitutionWithBranch: {
      required: ['name', 'branch'],
      properties: {
        name: {
          $ref: '#/definitions/InstnName',
        },
        branch: {
          $ref: '#/definitions/BranchName',
        },
        country: {
          $ref: '#/definitions/InstnCountry',
        },
      },
      type: 'object',
      title: 'Institution with branch',
      description: 'Details of an institution and its branch location.',
      name: 'Institution with branch',
    },
    BranchId: {
      maxLength: 35,
      type: 'string',
      title: 'Branch identifier',
      description:
        'Identifier for a branch, outlet, office or other location within the reporting entity.',
      name: 'Branch identifier',
    },
    BranchName: {
      maxLength: 120,
      type: 'string',
      title: 'Branch name',
      description: 'Name of the branch, outlet or office.',
      name: 'Branch name',
    },
    Branch: {
      required: ['name', 'address'],
      properties: {
        branchId: {
          $ref: '#/definitions/BranchId',
        },
        name: {
          $ref: '#/definitions/BranchName',
        },
        address: {
          $ref: '#/definitions/AddressNoCountry',
        },
      },
      type: 'object',
    },
    BranchOptAddr: {
      required: ['name'],
      properties: {
        branchId: {
          $ref: '#/definitions/BranchId',
        },
        name: {
          $ref: '#/definitions/BranchName',
        },
        address: {
          $ref: '#/definitions/AddressNoCountry',
        },
      },
      type: 'object',
      title: 'Branch or location',
      description:
        'Branch, office, outlet, or location details of the reporting entity.',
      name: 'Branch or location',
    },
    BranchOptCountry: {
      properties: {
        branchId: {
          $ref: '#/definitions/BranchId',
        },
        fullName: {
          $ref: '#/definitions/BranchName',
        },
        mainAddress: {
          $ref: '#/definitions/AddressBasic',
          title: 'Main address',
          description:
            "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address.",
          name: 'Main address',
        },
      },
      type: 'object',
    },
    AusBranch: {
      properties: {
        bsb: {
          $ref: '#/definitions/AcctBSB',
          description:
            "Mutually exclusive: Either 'bsb' or 'branchId' may be provided, but not both together.",
        },
        branchId: {
          $ref: '#/definitions/BranchId',
          description: "May only be provided when 'bsb' is absent.",
        },
        name: {
          $ref: '#/definitions/BranchName',
        },
      },
      type: 'object',
    },
    Direction: {
      enum: ['I', 'O'],
      type: 'string',
    },
    TfrType: {
      properties: {
        money: {
          description:
            'Use this to indicate when the transfer involved the movement of funds.',
          type: 'string',
          title: 'Money',
          name: 'Money',
        },
        property: {
          description:
            'Use this to indicate then the transfer involved property.',
          maxLength: 20,
          type: 'string',
          title: 'Property',
          name: 'Property',
        },
      },
      type: 'object',
      title: 'Transfer type',
      description: 'Indicates if the transfer involved money or property.',
      name: 'Transfer type',
    },
    TRN: {
      maxLength: 40,
      type: 'string',
      title: 'Transaction reference number',
      description: 'Reference number assigned to the transaction.',
      name: 'Transaction reference number',
    },
    REReportRef: {
      maxLength: 40,
      type: 'string',
      title: 'Reporting entity report reference',
      description:
        'Internal reference number for the suspicious matter report.',
      name: 'Reporting entity report reference',
    },
    NonCashAmount: {
      required: ['amount'],
      properties: {
        amount: {
          $ref: '#/definitions/Amount',
        },
      },
      type: 'object',
    },
    NonCashAmountCheque: {
      required: ['amount', 'cheque'],
      properties: {
        amount: {
          $ref: '#/definitions/Amount',
        },
        cheque: {
          $ref: '#/definitions/Cheque',
        },
      },
      type: 'object',
    },
    NonCashAmountChequeOptional: {
      required: ['amount'],
      properties: {
        amount: {
          $ref: '#/definitions/Amount',
        },
        cheque: {
          $ref: '#/definitions/Cheque',
        },
      },
      type: 'object',
    },
    NonCashAmountECurrency: {
      required: ['amount', 'eCurrency'],
      properties: {
        amount: {
          $ref: '#/definitions/Amount',
        },
        eCurrency: {
          items: {
            $ref: '#/definitions/ECurrency',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    NonCashAmountOther: {
      required: ['amount', 'desc'],
      properties: {
        amount: {
          $ref: '#/definitions/Amount',
        },
        desc: {
          maxLength: 30,
          type: 'string',
        },
        cheque: {
          items: {
            $ref: '#/definitions/Cheque',
          },
          type: 'array',
        },
      },
      type: 'object',
    },
    DrawerName: {
      $ref: '#/definitions/Name',
    },
    PayeeName: {
      $ref: '#/definitions/Name',
    },
    Cheque: {
      required: ['drawerName', 'payeeName'],
      properties: {
        drawerName: {
          $ref: '#/definitions/DrawerName',
        },
        payeeName: {
          $ref: '#/definitions/PayeeName',
        },
      },
      type: 'object',
    },
    ECurrency: {
      required: ['description'],
      properties: {
        description: {
          maxLength: 20,
          type: 'string',
        },
        denomination: {
          required: ['currencyDesc', 'amount'],
          properties: {
            currencyDesc: {
              maxLength: 35,
              type: 'string',
            },
            amount: {
              $ref: '#/definitions/Amount',
            },
          },
        },
        backingAsset: {
          properties: {
            assetType: {
              description:
                "Mutually exclusive: Either 'assetType' or 'otherDesc' may be provided, but not both at the same time.",
              enum: ['B', 'P'],
              type: 'string',
            },
            otherDesc: {
              description: "May only be provided when 'assetType' is absent.",
              maxLength: 20,
              type: 'string',
            },
          },
          title: 'Backing asset',
          description:
            'The asset or currency that the digital currency is backed by, e.g. USD, EUR.',
          name: 'Backing asset',
        },
      },
      type: 'object',
    },
    DigitalCurrency: {
      required: ['code', 'description', 'numberOfUnits'],
      properties: {
        code: {
          maxLength: 20,
          pattern: '[a-zA-Z0-9]+[\\\\@\\\\$a-zA-Z0-9]*',
          type: 'string',
          title: 'Code',
          description:
            'The code or symbol associated with the digital currency, e.g. BTC for Bitcoin, ETH for Ethereum.',
          name: 'Code',
        },
        description: {
          maxLength: 40,
          type: 'string',
          title: 'Description',
          description:
            'The description or name associated with the digital currency, e.g. Bitcoin, Ethereum',
          name: 'Description',
        },
        numberOfUnits: {
          $ref: '#/definitions/DecimalNumber',
        },
        backingAsset: {
          maxLength: 35,
          type: 'string',
          title: 'Backing asset',
          description:
            'The asset or currency that the digital currency is backed by, e.g. USD, EUR.',
          name: 'Backing asset',
        },
        fiatCurrencyAmount: {
          $ref: '#/definitions/CurrencyAmount',
        },
        blockchainTransactionId: {
          maxLength: 4000,
          pattern: '[0-9a-zA-Z]*',
          type: 'string',
          title: 'Blockchain transaction id',
          description:
            'The transaction hash (i.e. identifier) of the blockchain transaction, if applicable for this digital currency transfer.',
          name: 'Blockchain transaction id',
        },
      },
      type: 'object',
      title: 'Digital currency detail',
      description:
        'Details of a digital currency, including code, name, units, backing asset, fiat value, and optional blockchain transaction ID.',
      name: 'Digital currency detail',
    },
    PartyReference: {
      required: ['@refId'],
      properties: {
        '@refId': {
          type: 'string',
        },
      },
      type: 'object',
      title: 'Party reference',
      description:
        'Reference to another party already described in the report.',
      name: 'Party reference',
    },
    ReasonForTransfer: {
      maxLength: 4000,
      type: 'string',
    },
    DetailsOfPayment: {
      maxLength: 4000,
      type: 'string',
    },
    SenderToReceiverInfo: {
      maxLength: 210,
      type: 'string',
    },
    OtherDetails: {
      maxLength: 4000,
      type: 'string',
    },
    YesNo: {
      enum: ['Y', 'N'],
      type: 'string',
      title: 'Yes/no indicator',
      description: 'Indicates Yes or No.',
      name: 'Yes/no indicator',
    },
  },
}
