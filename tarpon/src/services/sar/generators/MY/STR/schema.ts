import {
  AccountStatus,
  Occupation,
  StateRelevantSource,
  StrIsReportedDueTo,
  SuspectedPredicateOffence,
  TransactionMethod,
  TransactionType,
  TypeOfProduct,
} from '@/services/sar/generators/MY/STR/schema-types/enums'

export const ReportDetailsAndSTRNature = {
  type: 'object',
  title: 'Report details & STR nature',
  'ui:schema': {
    'ui:group': 'Report details & STR nature',
  },
  properties: {
    reportDetails: {
      type: 'object',
      title: 'Report details',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
        description: {
          type: 'string',
          title: 'Description',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
        type: {
          type: 'string',
          enum: ['STR'],
          readOnly: true,
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        dateOfCreation: {
          type: 'string',
          format: 'date',
          readOnly: true,
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        referenceNumber: {
          type: 'string',
          description: 'Submit reference number of failed/ rejected reports',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
      },
      required: [],
    },
    natureOfStr: {
      type: 'object',
      title: 'Nature of STR',
      properties: {
        attemptedButNotCompleted: {
          type: 'boolean',
        },
        strIsReportedDueTo: StrIsReportedDueTo,
        stateRelevantSource: StateRelevantSource,
      },
      required: [
        'attemptedButNotCompleted',
        'strIsReportedDueTo',
        'stateRelevantSource',
      ],
    },
  },
  required: ['reportDetails', 'natureOfStr'],
}

export const RIandBasisOfSuspicion = {
  type: 'object',
  title: 'RI & Basis of suspicion',
  'ui:schema': {
    'ui:group': 'RI & Basis of suspicion',
  },
  properties: {
    reportInstitution: {
      type: 'object',
      title: 'Reporting institution (RI)',
      properties: {
        reportingOnBehalfOf: {
          type: 'string',
          title: 'Reporting on behalf of',
        },
      },
      required: ['reportingOnBehalfOf'],
    },
    basisOfSuspicion: {
      type: 'object',
      title: 'Basis of suspicion',
      properties: {
        suspectedPredicateOffence: SuspectedPredicateOffence,
        redFlagIndicator: {
          type: 'string',
          title: 'Red flag indicator',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
        descriptionOfTransactionPatternAndEntitiesConnectedToTheSuspiciousActivities:
          {
            type: 'string',
            title:
              'Description of transaction pattern and entities connected to the suspicious activities',
            'ui:schema': {
              'ui:subtype': 'TEXTAREA',
            },
          },
        detailsAndReasonsToSupportBasisOfSuspicion: {
          type: 'string',
          title: 'Details and reasons to support basis of suspicion',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
        actionsTakenByReportingInstitution: {
          type: 'string',
          title: 'Actions taken by reporting institution',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
        relatedToPoliticallyExposedPersonsPEPs: {
          type: 'boolean',
          title: 'Related to Politically Exposed Persons (PEPs)',
        },
        descriptionOfRelationshipWithPEPsIfYES: {
          type: 'string',
          title: 'Description of relationship with PEPs (If YES)',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
        keywordsRelatedToTheReport: {
          type: 'string',
          title: 'Keywords related to the report',
          'ui:schema': {
            'ui:subtype': 'TEXTAREA',
          },
        },
      },
      required: [
        'suspectedPredicateOffence',
        'redFlagIndicator',
        'descriptionOfTransactionPatternAndEntitiesConnectedToTheSuspiciousActivities',
        'detailsAndReasonsToSupportBasisOfSuspicion',
        'actionsTakenByReportingInstitution',
        'relatedToPoliticallyExposedPersonsPEPs',
      ],
    },
  },
  required: ['reportInstitution', 'basisOfSuspicion'],
}

export const Address = {
  type: 'object',
  properties: {
    streetAddress: {
      type: 'string',
    },
    nationality: {
      type: 'string',
      'ui:schema': {
        'ui:subtype': 'COUNTRY',
        'ui:width': 'HALF',
      },
    },
    state: {
      type: 'string',
      'ui:schema': {
        'ui:subtype': 'COUNTRY_REGION',
        'ui:countryField': 'nationality',
        'ui:width': 'HALF',
      },
    },
    zipCode: {
      type: 'string',
    },
    city: {
      type: 'string',
    },
  },
  required: ['streetAddress', 'state', 'nationality', 'zipCode', 'city'],
}

export const CustomerInformation = {
  type: 'object',
  title: 'Customer information',
  'ui:schema': {
    'ui:group': 'Customer information',
  },
  properties: {
    title: {
      type: 'string',
      title: 'Title',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    name: {
      type: 'string',
      title: 'Name',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    otherNameAlias: {
      type: 'string',
      title: 'Other name / Alias',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    gender: {
      type: 'string',
      enum: ['FEMALE', 'MALE', 'UNKNOWN'],
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    identificationNoNric: {
      type: 'string',
      title: 'Identification No (NRIC)',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    identificationNoPassport: {
      type: 'string',
      title: 'Identification No (Passport)',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    otherId: {
      type: 'string',
      title: 'Other ID',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    dateOfBirth: {
      type: 'string',
      format: 'date',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    residentialAddress: Address,
    correspondenceAddress: Address,
    emailID: {
      type: 'string',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    customerAmlRating: {
      type: 'string',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    contactNumber: {
      type: 'string',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    occupation: {
      ...Occupation,
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    occupationDescription: {
      type: 'string',
    },
  },
  required: [
    'name',
    'gender',
    'dateOfBirth',
    'residentialAddress',
    'correspondenceAddress',
    'occupation',
    'identificationNoNric',
  ],
}

export const AccountDetails = {
  type: 'object',
  title: 'Account details',
  'ui:schema': {
    'ui:group': 'Account details',
  },
  properties: {
    accountNo: {
      type: 'string',
      title: 'Account No',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    accountOpeningDate: {
      type: 'string',
      title: 'Account opening date',
      format: 'date',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    accountStatus: {
      ...AccountStatus,
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    currentPortfolioValueRm: {
      type: 'string',
      title: 'Current portfolio value (RM)',
      'ui:schema': {
        'ui:width': 'HALF',
      },
    },
    otherAccountsOrProductsMaintainedByCustomer: {
      type: 'object',
      title: 'Other accounts or products maintained by customer',
      properties: {
        accountNo: {
          type: 'string',
          title: 'Account No',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        productName: {
          type: 'string',
          title: 'Product name',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        typeOfProduct: {
          ...TypeOfProduct,
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        currentPortfolioValueRm: {
          type: 'string',
          title: 'Current portfolio value (RM)',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        dateOfProductPurchase: {
          type: 'string',
          title: 'Date of product purchase',
          format: 'date',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
      },
      required: [],
    },
    fundManagerAgentSalesPersonMarketingRepresentative: {
      type: 'object',
      title: 'Fund manager/Agent/Sales person/Marketing representative',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        identificationNoNricPassport: {
          type: 'string',
          title: 'Identification No (NRIC/Passport)',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        cmsrlLicenseNoUtcOrPrcFimmNo: {
          type: 'string',
          title: 'CMSRL License No/UTC or PRC FIMM No',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
        contactNumber: {
          type: 'string',
          'ui:schema': {
            'ui:width': 'HALF',
          },
        },
      },
      required: [
        'name',
        'identificationNoNricPassport',
        'cmsrlLicenseNoUtcOrPrcFimmNo',
        'contactNumber',
      ],
    },
  },
  required: ['accountNo', 'accountOpeningDate', 'accountStatus'],
}

export const schema = {
  $id: 'schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title:
    'This JSON Schema file was generated from schema on Tue Sep 19 2023 22:48:00 GMT+0530 (India Standard Time).  For more information please see http://www.xsd2jsonschema.org',
  description:
    "Schema tag attributes: xmlns:xs='http://www.w3.org/2001/XMLSchema' xmlns:xmime='http://www.w3.org/2005/05/xmlmime' xmlns='urn:lt:fntt:exchange:model:str' elementFormDefault='qualified' targetNamespace='urn:lt:fntt:exchange:model:str'",
  properties: {
    reportSchema: {
      type: 'object',
      properties: {
        reportDetailsAndSTRNature: ReportDetailsAndSTRNature,
        rIandBasisOfSuspicion: RIandBasisOfSuspicion,
      },
      required: ['reportDetailsAndSTRNature', 'rIandBasisOfSuspicion'],
    },
    customerAndAccountDetailsSchema: {
      type: 'object',
      properties: {
        customerInformation: CustomerInformation,
        accountDetails: AccountDetails,
      },
      required: ['customerInformation', 'accountDetails'],
    },
    transactionSchema: {
      type: 'object',
      properties: {
        productDetails: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              title: 'Product name',
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            typeOfProduct: {
              ...TypeOfProduct,
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            currentProductValueRm: {
              type: 'string',
              title: 'Current product value (RM)',
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            dateOfProductPurchase: {
              type: 'string',
              title: 'Date of product purchase',
              format: 'date',
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
          },
          required: ['typeOfProduct', 'currentProductValueRm'],
        },
        transactionDetails: {
          type: 'object',
          properties: {
            rangingTransactionDate: {
              type: 'string',
              title: 'Ranging transaction date',
              format: 'date',
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            transactionAmountRm: {
              type: 'string',
              title: 'Transaction amount (RM)',
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            transactionType: {
              ...TransactionType,
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
            transactionMethod: {
              ...TransactionMethod,
              'ui:schema': {
                'ui:width': 'HALF',
              },
            },
          },
          required: [
            'transactionAmountRm',
            'transactionType',
            'transactionMethod',
          ],
        },
      },
      required: ['productDetails', 'transactionDetails'],
    },
  },
  type: 'object',
  definitions: {},
}
