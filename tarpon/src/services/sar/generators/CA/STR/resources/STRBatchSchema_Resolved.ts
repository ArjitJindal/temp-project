export const FintracJsonSchemaResolved = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://fintrac-canafe.gc.ca/reporting-ingest/api/str/v1/schema#',
  title: 'Suspicious Transaction Report Schema',
  type: 'object',
  additionalProperties: false,
  properties: {
    reportDetails: {
      type: 'object',
      minItems: 1,
      additionalProperties: false,
      properties: {
        reportTypeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        submitTypeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        activitySectorCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
          title: 'Activity sector',
        },
        reportingEntityNumber: {
          title: 'Reporting entity number',
          type: 'number',
          minimum: 0,
          maximum: 9999999,
        },
        submittingReportingEntityNumber: {
          title: 'Submitting reporting entity number',
          type: 'number',
          minimum: 0,
          maximum: 9999999,
        },
        reportingEntityReportReference: {
          title: 'Reporting entity report reference number',
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,100}$',
        },
        reportingEntityContactId: {
          type: 'number',
          title: 'Contact identifier',
        },
        ministerialDirectiveCode: {
          title: 'Ministerial directive',
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
      },
      required: [
        'reportTypeCode',
        'submitTypeCode',
        'reportingEntityNumber',
        'submittingReportingEntityNumber',
        'reportingEntityReportReference',
        'reportingEntityContactId',
      ],
    },
    detailsOfSuspicion: {
      type: 'object',
      additionalProperties: false,
      properties: {
        descriptionOfSuspiciousActivity: {
          type: 'string',
          title: 'Description of suspicious activity',
        },
        suspicionTypeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
          title: 'Suspicion type',
        },
        publicPrivatePartnershipProjectNameCodes: {
          type: 'array',
          items: {
            type: 'integer',
            minimum: 1,
            maximum: 99999,
          },
          title: 'Public-private partnership project name',
        },
        politicallyExposedPersonIncludedIndicator: {
          type: 'boolean',
          title:
            "Was an individual's information who you have determined to be a politically exposed person (PEP) included in this report?",
        },
      },
      required: ['publicPrivatePartnershipProjectNameCodes'],
    },
    relatedReports: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportingEntityReportReference: {
            type: 'string',
            pattern: '^[A-Za-z0-9-_]{1,100}$',
          },
          reportingEntityTransactionReferences: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^[A-Za-z0-9-_]{1,200}$',
            },
          },
        },
        required: [
          'reportingEntityReportReference',
          'reportingEntityTransactionReferences',
        ],
      },
      title: 'Related reports',
    },
    actionTaken: {
      type: 'object',
      additionalProperties: false,
      properties: {
        description: {
          type: 'string',
          title: 'Description of action taken',
        },
      },
    },
    definitions: {
      type: 'array',
      items: {
        allOf: [
          {
            type: 'object',
            properties: {
              typeCode: {
                enum: [1, 2, 3, 4, 5, 6],
              },
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 1,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
              },
              required: ['typeCode', 'refId'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 2,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
              },
              required: ['typeCode', 'refId'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 3,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [3],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                alias: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                dateOfBirth: {
                  type: 'string',
                  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                },
                countryOfResidenceCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                occupation: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                nameOfEmployer: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: ['typeCode', 'refId', 'identifications'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 4,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [4],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                natureOfPrincipalBusiness: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                registrationIncorporationIndicator: {
                  type: 'boolean',
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_INDICATOR',
                  },
                },
                registrationsIncorporations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                authorizedPersons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: [
                'typeCode',
                'refId',
                'registrationsIncorporations',
                'identifications',
                'authorizedPersons',
              ],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 5,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [5],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                alias: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                dateOfBirth: {
                  type: 'string',
                  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                },
                countryOfResidenceCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                countryOfCitizenshipCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                occupation: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                employerInformation: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    addressTypeCode: {
                      enum: [1, 2],
                    },
                    address: {
                      oneOf: [
                        {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            typeCode: {
                              enum: [1],
                            },
                            unitNumber: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 10,
                            },
                            buildingNumber: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 10,
                            },
                            streetAddress: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            city: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            district: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            provinceStateCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY_REGION',
                                'ui:countryField': 'RawCountryCodeText',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                            provinceStateName: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            subProvinceSubLocality: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            postalZipCode: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 20,
                            },
                            countryCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                          },
                          required: ['typeCode'],
                        },
                        {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            typeCode: {
                              enum: [2],
                            },
                            countryCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                            unstructured: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 500,
                            },
                          },
                          required: ['typeCode', 'unstructured'],
                        },
                      ],
                    },
                    telephoneNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 20,
                    },
                    extensionNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 10,
                    },
                  },
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: ['typeCode', 'refId', 'identifications'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 6,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [6],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                authorizedPersons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                structureTypeCode: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 99999,
                },
                structureTypeOther: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                natureOfPrincipalBusiness: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                registrationIncorporationIndicator: {
                  type: 'boolean',
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_INDICATOR',
                  },
                },
                registrationsIncorporations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                directorsOfCorporation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningSharesOfCorporation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                trusteesOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                settlorsOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningUnitsOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                beneficiariesOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningEntityNotCorporationOrTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: [
                'typeCode',
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
            },
          },
        ],
      },
    },
    transactions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportingEntityLocationId: {
            type: 'string',
            minLength: 0,
            maxLength: 30,
          },
          suspiciousTransactionDetails: {
            type: 'object',
            additionalProperties: false,
            properties: {
              attemptedTransactionIndicator: {
                type: 'boolean',
              },
              reasonNotCompleted: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              dateOfTransaction: {
                type: 'string',
                pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
              },
              timeOfTransaction: {
                type: 'string',
                pattern:
                  '^[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
              },
              methodCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              methodOther: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              dateOfPosting: {
                type: 'string',
                pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
              },
              timeOfPosting: {
                type: 'string',
                pattern:
                  '^[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
              },
              reportingEntityTransactionReference: {
                type: 'string',
                pattern: '^[A-Za-z0-9-_]{1,200}$',
              },
              purpose: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
            },
            required: ['attemptedTransactionIndicator'],
          },
          startingActions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                details: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    direction: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 99999,
                    },
                    fundAssetVirtualCurrencyTypeCode: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 99999,
                    },
                    fundAssetVirtualCurrencyTypeOther: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    amount: {
                      type: 'string',
                      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
                    },
                    currencyCode: {
                      type: 'string',
                      minLength: 3,
                      maxLength: 3,
                    },
                    virtualCurrencyTypeCode: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 20,
                    },
                    virtualCurrencyTypeOther: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    exchangeRate: {
                      type: 'string',
                      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
                    },
                    virtualCurrencyTransactionIds: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    sendingVirtualCurrencyAddresses: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    receivingVirtualCurrencyAddresses: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    referenceNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    referenceNumberOtherRelatedNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    account: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        financialInstitutionNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 50,
                        },
                        branchNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 50,
                        },
                        number: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        typeCode: {
                          type: 'integer',
                          minimum: 1,
                          maximum: 99999,
                        },
                        typeOther: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 200,
                        },
                        currencyCode: {
                          type: 'string',
                          minLength: 3,
                          maxLength: 3,
                        },
                        virtualCurrencyTypeCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        virtualCurrencyTypeOther: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 200,
                        },
                        dateOpened: {
                          type: 'string',
                          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                        },
                        dateClosed: {
                          type: 'string',
                          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                        },
                        holders: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1, 2],
                              },
                              refId: {
                                type: 'string',
                                pattern: '^[A-Za-z0-9-_]{1,50}$',
                              },
                            },
                            required: ['typeCode', 'refId'],
                          },
                        },
                      },
                      required: ['holders'],
                    },
                    accountStatusAtTimeOfTransaction: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 99999,
                    },
                    howFundsOrVirtualCurrencyObtained: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    sourcesOfFundsOrVirtualCurrencyIndicator: {
                      type: 'boolean',
                    },
                    conductorIndicator: {
                      type: 'boolean',
                    },
                  },
                  required: [
                    'virtualCurrencyTransactionIds',
                    'receivingVirtualCurrencyAddresses',
                    'sendingVirtualCurrencyAddresses',
                  ],
                },
                sourcesOfFundsOrVirtualCurrency: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1, 2],
                      },
                      refId: {
                        type: 'string',
                        pattern: '^[A-Za-z0-9-_]{1,50}$',
                      },
                      details: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          accountNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          policyNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          identifyingNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                        },
                      },
                    },
                    required: ['typeCode', 'refId'],
                  },
                },
                conductors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [5, 6],
                      },
                      refId: {
                        type: 'string',
                        pattern: '^[A-Za-z0-9-_]{1,50}$',
                      },
                      details: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          clientNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          emailAddress: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 200,
                          },
                          url: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 200,
                          },
                          typeOfDeviceCode: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 99999,
                          },
                          typeOfDeviceOther: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 200,
                          },
                          username: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          deviceIdentifierNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 200,
                          },
                          internetProtocolAddress: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 200,
                          },
                          dateTimeOfOnlineSession: {
                            type: 'string',
                            pattern:
                              '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
                          },
                          onBehalfOfIndicator: {
                            type: 'boolean',
                          },
                        },
                      },
                      onBehalfOfs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            typeCode: {
                              enum: [5, 6],
                            },
                            refId: {
                              type: 'string',
                              pattern: '^[A-Za-z0-9-_]{1,50}$',
                            },
                            details: {
                              type: 'object',
                              additionalProperties: false,
                              properties: {
                                clientNumber: {
                                  type: 'string',
                                  minLength: 0,
                                  maxLength: 100,
                                },
                                emailAddress: {
                                  type: 'string',
                                  minLength: 0,
                                  maxLength: 200,
                                },
                                url: {
                                  type: 'string',
                                  minLength: 0,
                                  maxLength: 200,
                                },
                                relationshipOfConductorCode: {
                                  type: 'integer',
                                  minimum: 1,
                                  maximum: 99999,
                                },
                                relationshipOfConductorOther: {
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
                },
              },
              required: [
                'details',
                'sourcesOfFundsOrVirtualCurrency',
                'conductors',
              ],
            },
          },
          completingActions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                details: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    dispositionCode: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 99999,
                    },
                    dispositionOther: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    amount: {
                      type: 'string',
                      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
                    },
                    currencyCode: {
                      type: 'string',
                      minLength: 3,
                      maxLength: 3,
                    },
                    virtualCurrencyTypeCode: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 20,
                    },
                    virtualCurrencyTypeOther: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    exchangeRate: {
                      type: 'string',
                      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
                    },
                    valueInCanadianDollars: {
                      type: 'string',
                      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
                    },
                    virtualCurrencyTransactionIds: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    sendingVirtualCurrencyAddresses: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    receivingVirtualCurrencyAddresses: {
                      type: 'array',
                      items: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                    },
                    referenceNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    referenceNumberOtherRelatedNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 200,
                    },
                    account: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        financialInstitutionNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 50,
                        },
                        branchNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 50,
                        },
                        number: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        typeCode: {
                          type: 'integer',
                          minimum: 1,
                          maximum: 99999,
                        },
                        typeOther: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 200,
                        },
                        currencyCode: {
                          type: 'string',
                          minLength: 3,
                          maxLength: 3,
                        },
                        virtualCurrencyTypeCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        virtualCurrencyTypeOther: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 200,
                        },
                        dateOpened: {
                          type: 'string',
                          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                        },
                        dateClosed: {
                          type: 'string',
                          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                        },
                        holders: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1, 2],
                              },
                              refId: {
                                type: 'string',
                                pattern: '^[A-Za-z0-9-_]{1,50}$',
                              },
                            },
                            required: ['typeCode', 'refId'],
                          },
                        },
                      },
                      required: ['holders'],
                    },
                    accountStatusAtTimeOfTransaction: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 99999,
                    },
                    involvementIndicator: {
                      type: 'boolean',
                    },
                    beneficiaryIndicator: {
                      type: 'boolean',
                    },
                  },
                  required: [
                    'virtualCurrencyTransactionIds',
                    'receivingVirtualCurrencyAddresses',
                    'sendingVirtualCurrencyAddresses',
                  ],
                },
                involvements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1, 2],
                      },
                      refId: {
                        type: 'string',
                        pattern: '^[A-Za-z0-9-_]{1,50}$',
                      },
                      details: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          accountNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          identifyingNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          policyNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                        },
                      },
                    },
                    required: ['typeCode', 'refId'],
                  },
                },
                beneficiaries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [3, 4],
                      },
                      refId: {
                        type: 'string',
                        pattern: '^[A-Za-z0-9-_]{1,50}$',
                      },
                      details: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          clientNumber: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          username: {
                            type: 'string',
                            minLength: 0,
                            maxLength: 100,
                          },
                          emailAddress: {
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
              required: ['details', 'involvements', 'beneficiaries'],
            },
          },
        },
        required: [
          'reportingEntityLocationId',
          'suspiciousTransactionDetails',
          'startingActions',
          'completingActions',
        ],
      },
      title: 'Transaction list',
    },
  },
  required: [
    'reportDetails',
    'detailsOfSuspicion',
    'relatedReports',
    'definitions',
    'transactions',
  ],
  definitions: {
    personEntityData: {
      type: 'array',
      items: {
        allOf: [
          {
            type: 'object',
            properties: {
              typeCode: {
                enum: [1, 2, 3, 4, 5, 6],
              },
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 1,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
              },
              required: ['typeCode', 'refId'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 2,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
              },
              required: ['typeCode', 'refId'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 3,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [3],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                alias: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                dateOfBirth: {
                  type: 'string',
                  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                },
                countryOfResidenceCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                occupation: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                nameOfEmployer: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: ['typeCode', 'refId', 'identifications'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 4,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [4],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                natureOfPrincipalBusiness: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                registrationIncorporationIndicator: {
                  type: 'boolean',
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_INDICATOR',
                  },
                },
                registrationsIncorporations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                authorizedPersons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: [
                'typeCode',
                'refId',
                'registrationsIncorporations',
                'identifications',
                'authorizedPersons',
              ],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 5,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [5],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                surname: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                givenName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                otherNameInitial: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                alias: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                dateOfBirth: {
                  type: 'string',
                  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
                },
                countryOfResidenceCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                countryOfCitizenshipCode: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                occupation: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                employerInformation: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    addressTypeCode: {
                      enum: [1, 2],
                    },
                    address: {
                      oneOf: [
                        {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            typeCode: {
                              enum: [1],
                            },
                            unitNumber: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 10,
                            },
                            buildingNumber: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 10,
                            },
                            streetAddress: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            city: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            district: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            provinceStateCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY_REGION',
                                'ui:countryField': 'RawCountryCodeText',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                            provinceStateName: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            subProvinceSubLocality: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 100,
                            },
                            postalZipCode: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 20,
                            },
                            countryCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                          },
                          required: ['typeCode'],
                        },
                        {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            typeCode: {
                              enum: [2],
                            },
                            countryCode: {
                              'ui:schema': {
                                'ui:subtype': 'COUNTRY',
                              },
                              type: 'string',
                              minLength: 2,
                              maxLength: 2,
                            },
                            unstructured: {
                              type: 'string',
                              minLength: 0,
                              maxLength: 500,
                            },
                          },
                          required: ['typeCode', 'unstructured'],
                        },
                      ],
                    },
                    telephoneNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 20,
                    },
                    extensionNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 10,
                    },
                  },
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: ['typeCode', 'refId', 'identifications'],
            },
          },
          {
            if: {
              properties: {
                typeCode: {
                  const: 6,
                },
              },
            },
            then: {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [6],
                },
                refId: {
                  type: 'string',
                  pattern: '^[A-Za-z0-9-_]{1,50}$',
                },
                nameOfEntity: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                addressTypeCode: {
                  enum: [1, 2],
                },
                address: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [1],
                        },
                        unitNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        buildingNumber: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 10,
                        },
                        streetAddress: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        city: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        district: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        provinceStateCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY_REGION',
                            'ui:countryField': 'RawCountryCodeText',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        provinceStateName: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        subProvinceSubLocality: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 100,
                        },
                        postalZipCode: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20,
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                      },
                      required: ['typeCode'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        typeCode: {
                          enum: [2],
                        },
                        countryCode: {
                          'ui:schema': {
                            'ui:subtype': 'COUNTRY',
                          },
                          type: 'string',
                          minLength: 2,
                          maxLength: 2,
                        },
                        unstructured: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 500,
                        },
                      },
                      required: ['typeCode', 'unstructured'],
                    },
                  ],
                },
                telephoneNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                extensionNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                identifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      identifierTypeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      identifierTypeOther: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 200,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                authorizedPersons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                structureTypeCode: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 99999,
                },
                structureTypeOther: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                natureOfPrincipalBusiness: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 200,
                },
                registrationIncorporationIndicator: {
                  type: 'boolean',
                  'ui:schema': {
                    'ui:subtype': 'FINCEN_INDICATOR',
                  },
                },
                registrationsIncorporations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 99999,
                      },
                      number: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      jurisdictionOfIssueCountryCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                      },
                      jurisdictionOfIssueProvinceStateCode: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                      },
                      jurisdictionOfIssueProvinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                directorsOfCorporation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningSharesOfCorporation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
                trusteesOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                settlorsOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningUnitsOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                beneficiariesOfTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      addressTypeCode: {
                        enum: [1, 2],
                      },
                      address: {
                        oneOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [1],
                              },
                              unitNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              buildingNumber: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 10,
                              },
                              streetAddress: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              city: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              district: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              provinceStateCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY_REGION',
                                  'ui:countryField': 'RawCountryCodeText',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              provinceStateName: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              subProvinceSubLocality: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 100,
                              },
                              postalZipCode: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 20,
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                            },
                            required: ['typeCode'],
                          },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              typeCode: {
                                enum: [2],
                              },
                              countryCode: {
                                'ui:schema': {
                                  'ui:subtype': 'COUNTRY',
                                },
                                type: 'string',
                                minLength: 2,
                                maxLength: 2,
                              },
                              unstructured: {
                                type: 'string',
                                minLength: 0,
                                maxLength: 500,
                              },
                            },
                            required: ['typeCode', 'unstructured'],
                          },
                        ],
                      },
                      telephoneNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      extensionNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                    },
                  },
                },
                personsOwningEntityNotCorporationOrTrust: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      surname: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      givenName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      otherNameInitial: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                    },
                  },
                },
              },
              required: [
                'typeCode',
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
            },
          },
        ],
      },
    },
    personName: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [1],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        givenName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        surname: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        otherNameInitial: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
      },
      required: ['typeCode', 'refId'],
    },
    entityName: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [2],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        nameOfEntity: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
      },
      required: ['typeCode', 'refId'],
    },
    personDetails: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [3],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        surname: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        givenName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        otherNameInitial: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        alias: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        addressTypeCode: {
          enum: [1, 2],
        },
        address: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                unitNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                buildingNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                streetAddress: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                city: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                district: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                provinceStateCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY_REGION',
                    'ui:countryField': 'RawCountryCodeText',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                provinceStateName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                subProvinceSubLocality: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                postalZipCode: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
              },
              required: ['typeCode'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                unstructured: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 500,
                },
              },
              required: ['typeCode', 'unstructured'],
            },
          ],
        },
        telephoneNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        extensionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        dateOfBirth: {
          type: 'string',
          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
        },
        countryOfResidenceCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
        occupation: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        nameOfEmployer: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        identifications: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              identifierTypeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              identifierTypeOther: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
      },
      required: ['typeCode', 'refId', 'identifications'],
    },
    entityDetails: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [4],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        nameOfEntity: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        addressTypeCode: {
          enum: [1, 2],
        },
        address: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                unitNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                buildingNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                streetAddress: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                city: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                district: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                provinceStateCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY_REGION',
                    'ui:countryField': 'RawCountryCodeText',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                provinceStateName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                subProvinceSubLocality: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                postalZipCode: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
              },
              required: ['typeCode'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                unstructured: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 500,
                },
              },
              required: ['typeCode', 'unstructured'],
            },
          ],
        },
        telephoneNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        extensionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        natureOfPrincipalBusiness: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        registrationIncorporationIndicator: {
          type: 'boolean',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        registrationsIncorporations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              typeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        identifications: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              identifierTypeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              identifierTypeOther: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        authorizedPersons: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
      },
      required: [
        'typeCode',
        'refId',
        'registrationsIncorporations',
        'identifications',
        'authorizedPersons',
      ],
    },
    personAndEmployerDetails: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [5],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        surname: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        givenName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        otherNameInitial: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        alias: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        addressTypeCode: {
          enum: [1, 2],
        },
        address: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                unitNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                buildingNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                streetAddress: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                city: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                district: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                provinceStateCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY_REGION',
                    'ui:countryField': 'RawCountryCodeText',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                provinceStateName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                subProvinceSubLocality: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                postalZipCode: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
              },
              required: ['typeCode'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                unstructured: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 500,
                },
              },
              required: ['typeCode', 'unstructured'],
            },
          ],
        },
        telephoneNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        extensionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        dateOfBirth: {
          type: 'string',
          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
        },
        countryOfResidenceCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
        countryOfCitizenshipCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
        occupation: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        employerInformation: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 0,
              maxLength: 100,
            },
            addressTypeCode: {
              enum: [1, 2],
            },
            address: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    typeCode: {
                      enum: [1],
                    },
                    unitNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 10,
                    },
                    buildingNumber: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 10,
                    },
                    streetAddress: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    city: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    district: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    provinceStateCode: {
                      'ui:schema': {
                        'ui:subtype': 'COUNTRY_REGION',
                        'ui:countryField': 'RawCountryCodeText',
                      },
                      type: 'string',
                      minLength: 2,
                      maxLength: 2,
                    },
                    provinceStateName: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    subProvinceSubLocality: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 100,
                    },
                    postalZipCode: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 20,
                    },
                    countryCode: {
                      'ui:schema': {
                        'ui:subtype': 'COUNTRY',
                      },
                      type: 'string',
                      minLength: 2,
                      maxLength: 2,
                    },
                  },
                  required: ['typeCode'],
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    typeCode: {
                      enum: [2],
                    },
                    countryCode: {
                      'ui:schema': {
                        'ui:subtype': 'COUNTRY',
                      },
                      type: 'string',
                      minLength: 2,
                      maxLength: 2,
                    },
                    unstructured: {
                      type: 'string',
                      minLength: 0,
                      maxLength: 500,
                    },
                  },
                  required: ['typeCode', 'unstructured'],
                },
              ],
            },
            telephoneNumber: {
              type: 'string',
              minLength: 0,
              maxLength: 20,
            },
            extensionNumber: {
              type: 'string',
              minLength: 0,
              maxLength: 10,
            },
          },
        },
        identifications: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              identifierTypeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              identifierTypeOther: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
      },
      required: ['typeCode', 'refId', 'identifications'],
    },
    entityAndBeneficialOwnershipDetails: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [6],
        },
        refId: {
          type: 'string',
          pattern: '^[A-Za-z0-9-_]{1,50}$',
        },
        nameOfEntity: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        addressTypeCode: {
          enum: [1, 2],
        },
        address: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                unitNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                buildingNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                streetAddress: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                city: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                district: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                provinceStateCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY_REGION',
                    'ui:countryField': 'RawCountryCodeText',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                provinceStateName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                subProvinceSubLocality: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                postalZipCode: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
              },
              required: ['typeCode'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                unstructured: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 500,
                },
              },
              required: ['typeCode', 'unstructured'],
            },
          ],
        },
        telephoneNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        extensionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        identifications: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              identifierTypeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              identifierTypeOther: {
                type: 'string',
                minLength: 0,
                maxLength: 200,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        authorizedPersons: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        structureTypeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        structureTypeOther: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        natureOfPrincipalBusiness: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        registrationIncorporationIndicator: {
          type: 'boolean',
          'ui:schema': {
            'ui:subtype': 'FINCEN_INDICATOR',
          },
        },
        registrationsIncorporations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              typeCode: {
                type: 'integer',
                minimum: 1,
                maximum: 99999,
              },
              number: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              jurisdictionOfIssueCountryCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY',
                },
              },
              jurisdictionOfIssueProvinceStateCode: {
                type: 'string',
                minLength: 2,
                maxLength: 2,
                'ui:schema': {
                  'ui:subtype': 'COUNTRY_REGION',
                  'ui:countryField': 'RawCountryCodeText',
                },
              },
              jurisdictionOfIssueProvinceStateName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        directorsOfCorporation: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              addressTypeCode: {
                enum: [1, 2],
              },
              address: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1],
                      },
                      unitNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      buildingNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      streetAddress: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      city: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      district: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      provinceStateCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      provinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      subProvinceSubLocality: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      postalZipCode: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                    },
                    required: ['typeCode'],
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [2],
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      unstructured: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 500,
                      },
                    },
                    required: ['typeCode', 'unstructured'],
                  },
                ],
              },
              telephoneNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 20,
              },
              extensionNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 10,
              },
            },
          },
        },
        personsOwningSharesOfCorporation: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
        trusteesOfTrust: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              addressTypeCode: {
                enum: [1, 2],
              },
              address: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1],
                      },
                      unitNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      buildingNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      streetAddress: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      city: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      district: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      provinceStateCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      provinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      subProvinceSubLocality: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      postalZipCode: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                    },
                    required: ['typeCode'],
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [2],
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      unstructured: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 500,
                      },
                    },
                    required: ['typeCode', 'unstructured'],
                  },
                ],
              },
              telephoneNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 20,
              },
              extensionNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 10,
              },
            },
          },
        },
        settlorsOfTrust: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              addressTypeCode: {
                enum: [1, 2],
              },
              address: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1],
                      },
                      unitNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      buildingNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      streetAddress: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      city: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      district: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      provinceStateCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      provinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      subProvinceSubLocality: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      postalZipCode: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                    },
                    required: ['typeCode'],
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [2],
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      unstructured: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 500,
                      },
                    },
                    required: ['typeCode', 'unstructured'],
                  },
                ],
              },
              telephoneNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 20,
              },
              extensionNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 10,
              },
            },
          },
        },
        personsOwningUnitsOfTrust: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              addressTypeCode: {
                enum: [1, 2],
              },
              address: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1],
                      },
                      unitNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      buildingNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      streetAddress: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      city: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      district: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      provinceStateCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      provinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      subProvinceSubLocality: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      postalZipCode: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                    },
                    required: ['typeCode'],
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [2],
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      unstructured: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 500,
                      },
                    },
                    required: ['typeCode', 'unstructured'],
                  },
                ],
              },
              telephoneNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 20,
              },
              extensionNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 10,
              },
            },
          },
        },
        beneficiariesOfTrust: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              addressTypeCode: {
                enum: [1, 2],
              },
              address: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [1],
                      },
                      unitNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      buildingNumber: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 10,
                      },
                      streetAddress: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      city: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      district: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      provinceStateCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY_REGION',
                          'ui:countryField': 'RawCountryCodeText',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      provinceStateName: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      subProvinceSubLocality: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 100,
                      },
                      postalZipCode: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20,
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                    },
                    required: ['typeCode'],
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      typeCode: {
                        enum: [2],
                      },
                      countryCode: {
                        'ui:schema': {
                          'ui:subtype': 'COUNTRY',
                        },
                        type: 'string',
                        minLength: 2,
                        maxLength: 2,
                      },
                      unstructured: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 500,
                      },
                    },
                    required: ['typeCode', 'unstructured'],
                  },
                ],
              },
              telephoneNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 20,
              },
              extensionNumber: {
                type: 'string',
                minLength: 0,
                maxLength: 10,
              },
            },
          },
        },
        personsOwningEntityNotCorporationOrTrust: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              surname: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              givenName: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
              otherNameInitial: {
                type: 'string',
                minLength: 0,
                maxLength: 100,
              },
            },
          },
        },
      },
      required: [
        'typeCode',
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
    },
    structuredAddress: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [1],
        },
        unitNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        buildingNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
        streetAddress: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        city: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        district: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        provinceStateCode: {
          'ui:schema': {
            'ui:subtype': 'COUNTRY_REGION',
            'ui:countryField': 'RawCountryCodeText',
          },
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
        provinceStateName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        subProvinceSubLocality: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        postalZipCode: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        countryCode: {
          'ui:schema': {
            'ui:subtype': 'COUNTRY',
          },
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
      },
      required: ['typeCode'],
    },
    unstructuredAddress: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          enum: [2],
        },
        countryCode: {
          'ui:schema': {
            'ui:subtype': 'COUNTRY',
          },
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
        unstructured: {
          type: 'string',
          minLength: 0,
          maxLength: 500,
        },
      },
      required: ['typeCode', 'unstructured'],
    },
    personContact: {
      type: 'object',
      additionalProperties: false,
      properties: {
        surname: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        givenName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        otherNameInitial: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        addressTypeCode: {
          enum: [1, 2],
        },
        address: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [1],
                },
                unitNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                buildingNumber: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 10,
                },
                streetAddress: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                city: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                district: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                provinceStateCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY_REGION',
                    'ui:countryField': 'RawCountryCodeText',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                provinceStateName: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                subProvinceSubLocality: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 100,
                },
                postalZipCode: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20,
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
              },
              required: ['typeCode'],
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                typeCode: {
                  enum: [2],
                },
                countryCode: {
                  'ui:schema': {
                    'ui:subtype': 'COUNTRY',
                  },
                  type: 'string',
                  minLength: 2,
                  maxLength: 2,
                },
                unstructured: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 500,
                },
              },
              required: ['typeCode', 'unstructured'],
            },
          ],
        },
        telephoneNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        extensionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 10,
        },
      },
    },
    identification: {
      type: 'object',
      additionalProperties: false,
      properties: {
        identifierTypeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        identifierTypeOther: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        number: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        jurisdictionOfIssueCountryCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
          'ui:schema': {
            'ui:subtype': 'COUNTRY',
          },
        },
        jurisdictionOfIssueProvinceStateCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
          'ui:schema': {
            'ui:subtype': 'COUNTRY_REGION',
            'ui:countryField': 'RawCountryCodeText',
          },
        },
        jurisdictionOfIssueProvinceStateName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
      },
    },
    authorizedPerson: {
      type: 'object',
      additionalProperties: false,
      properties: {
        surname: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        givenName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        otherNameInitial: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
      },
    },
    registrationIncorporation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        typeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        number: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        jurisdictionOfIssueCountryCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
          'ui:schema': {
            'ui:subtype': 'COUNTRY',
          },
        },
        jurisdictionOfIssueProvinceStateCode: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
          'ui:schema': {
            'ui:subtype': 'COUNTRY_REGION',
            'ui:countryField': 'RawCountryCodeText',
          },
        },
        jurisdictionOfIssueProvinceStateName: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
      },
    },
    account: {
      type: 'object',
      additionalProperties: false,
      properties: {
        financialInstitutionNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 50,
        },
        branchNumber: {
          type: 'string',
          minLength: 0,
          maxLength: 50,
        },
        number: {
          type: 'string',
          minLength: 0,
          maxLength: 100,
        },
        typeCode: {
          type: 'integer',
          minimum: 1,
          maximum: 99999,
        },
        typeOther: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        currencyCode: {
          type: 'string',
          minLength: 3,
          maxLength: 3,
        },
        virtualCurrencyTypeCode: {
          type: 'string',
          minLength: 0,
          maxLength: 20,
        },
        virtualCurrencyTypeOther: {
          type: 'string',
          minLength: 0,
          maxLength: 200,
        },
        dateOpened: {
          type: 'string',
          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
        },
        dateClosed: {
          type: 'string',
          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
        },
        holders: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              typeCode: {
                enum: [1, 2],
              },
              refId: {
                type: 'string',
                pattern: '^[A-Za-z0-9-_]{1,50}$',
              },
            },
            required: ['typeCode', 'refId'],
          },
        },
      },
      required: ['holders'],
    },
    alpha2: {
      type: 'string',
      minLength: 2,
      maxLength: 2,
    },
    alpha3: {
      type: 'string',
      minLength: 3,
      maxLength: 3,
    },
    string10: {
      type: 'string',
      minLength: 0,
      maxLength: 10,
    },
    string20: {
      type: 'string',
      minLength: 0,
      maxLength: 20,
    },
    string30: {
      type: 'string',
      minLength: 0,
      maxLength: 30,
    },
    string50: {
      type: 'string',
      minLength: 0,
      maxLength: 50,
    },
    string100: {
      type: 'string',
      minLength: 0,
      maxLength: 100,
    },
    string200: {
      type: 'string',
      minLength: 0,
      maxLength: 200,
    },
    string500: {
      type: 'string',
      minLength: 0,
      maxLength: 500,
    },
    optionTypeCode: {
      type: 'integer',
      minimum: 1,
      maximum: 99999,
    },
    externalReportReference: {
      type: 'string',
      pattern: '^[A-Za-z0-9-_]{1,100}$',
    },
    externalTransactionReference: {
      type: 'string',
      pattern: '^[A-Za-z0-9-_]{1,200}$',
    },
    refId: {
      type: 'string',
      pattern: '^[A-Za-z0-9-_]{1,50}$',
    },
    reNumber: {
      type: 'number',
      minimum: 0,
      maximum: 9999999,
    },
    telephone: {
      type: 'string',
      minLength: 0,
      maxLength: 20,
    },
    telephoneExtension: {
      type: 'string',
      minLength: 0,
      maxLength: 10,
    },
    currencyAmount: {
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
    },
    exchangeRate: {
      type: 'string',
      pattern: '^\\d{1,17}(\\.\\d{2,10})?$',
    },
    zonedDateTime: {
      type: 'string',
      pattern:
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
    },
    localDate: {
      type: 'string',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    zonedTime: {
      type: 'string',
      pattern: '^[0-9]{2}:[0-9]{2}:[0-9]{2}[\\-\\+][0-9]{2}:[0-9]{2}$',
    },
  },
}
