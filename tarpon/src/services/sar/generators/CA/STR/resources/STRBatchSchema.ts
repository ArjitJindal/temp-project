export const FintracJsonSchema = {
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
          $ref: '#/definitions/optionTypeCode',
        },

        submitTypeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        activitySectorCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        reportingEntityNumber: {
          $ref: '#/definitions/reNumber',
        },

        submittingReportingEntityNumber: {
          $ref: '#/definitions/reNumber',
        },

        reportingEntityReportReference: {
          $ref: '#/definitions/externalReportReference',
        },

        reportingEntityContactId: {
          type: 'number',
        },

        ministerialDirectiveCode: {
          $ref: '#/definitions/string20',
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
        },

        suspicionTypeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        publicPrivatePartnershipProjectNameCodes: {
          type: 'array',

          items: {
            $ref: '#/definitions/optionTypeCode',
          },
        },

        politicallyExposedPersonIncludedIndicator: {
          type: 'boolean',
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
            $ref: '#/definitions/externalReportReference',
          },

          reportingEntityTransactionReferences: {
            type: 'array',

            items: {
              $ref: '#/definitions/externalTransactionReference',
            },
          },
        },

        required: [
          'reportingEntityReportReference',

          'reportingEntityTransactionReferences',
        ],
      },
    },

    actionTaken: {
      type: 'object',

      additionalProperties: false,

      properties: {
        description: {
          type: 'string',
        },
      },
    },

    definitions: {
      $ref: '#/definitions/personEntityData',
    },

    transactions: {
      type: 'array',

      minItems: 1,

      items: {
        type: 'object',

        additionalProperties: false,

        properties: {
          reportingEntityLocationId: {
            $ref: '#/definitions/string30',
          },

          suspiciousTransactionDetails: {
            type: 'object',

            additionalProperties: false,

            properties: {
              attemptedTransactionIndicator: {
                type: 'boolean',
              },

              reasonNotCompleted: {
                $ref: '#/definitions/string200',
              },

              dateOfTransaction: {
                $ref: '#/definitions/localDate',
              },

              timeOfTransaction: {
                $ref: '#/definitions/zonedTime',
              },

              methodCode: {
                $ref: '#/definitions/optionTypeCode',
              },

              methodOther: {
                $ref: '#/definitions/string200',
              },

              dateOfPosting: {
                $ref: '#/definitions/localDate',
              },

              timeOfPosting: {
                $ref: '#/definitions/zonedTime',
              },

              reportingEntityTransactionReference: {
                $ref: '#/definitions/externalTransactionReference',
              },

              purpose: {
                $ref: '#/definitions/string200',
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
                      $ref: '#/definitions/optionTypeCode',
                    },

                    fundAssetVirtualCurrencyTypeCode: {
                      $ref: '#/definitions/optionTypeCode',
                    },

                    fundAssetVirtualCurrencyTypeOther: {
                      $ref: '#/definitions/string200',
                    },

                    amount: {
                      $ref: '#/definitions/currencyAmount',
                    },

                    currencyCode: {
                      $ref: '#/definitions/alpha3',
                    },

                    virtualCurrencyTypeCode: {
                      $ref: '#/definitions/string20',
                    },

                    virtualCurrencyTypeOther: {
                      $ref: '#/definitions/string200',
                    },

                    exchangeRate: {
                      $ref: '#/definitions/exchangeRate',
                    },

                    virtualCurrencyTransactionIds: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    sendingVirtualCurrencyAddresses: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    receivingVirtualCurrencyAddresses: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    referenceNumber: {
                      $ref: '#/definitions/string200',
                    },

                    referenceNumberOtherRelatedNumber: {
                      $ref: '#/definitions/string200',
                    },

                    account: {
                      $ref: '#/definitions/account',
                    },

                    accountStatusAtTimeOfTransaction: {
                      $ref: '#/definitions/optionTypeCode',
                    },

                    howFundsOrVirtualCurrencyObtained: {
                      $ref: '#/definitions/string200',
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
                        enum: [
                          1,

                          2,
                        ],
                      },

                      refId: {
                        $ref: '#/definitions/refId',
                      },

                      details: {
                        type: 'object',

                        additionalProperties: false,

                        properties: {
                          accountNumber: {
                            $ref: '#/definitions/string100',
                          },

                          policyNumber: {
                            $ref: '#/definitions/string100',
                          },

                          identifyingNumber: {
                            $ref: '#/definitions/string100',
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
                        enum: [
                          5,

                          6,
                        ],
                      },

                      refId: {
                        $ref: '#/definitions/refId',
                      },

                      details: {
                        type: 'object',

                        additionalProperties: false,

                        properties: {
                          clientNumber: {
                            $ref: '#/definitions/string100',
                          },

                          emailAddress: {
                            $ref: '#/definitions/string200',
                          },

                          url: {
                            $ref: '#/definitions/string200',
                          },

                          typeOfDeviceCode: {
                            $ref: '#/definitions/optionTypeCode',
                          },

                          typeOfDeviceOther: {
                            $ref: '#/definitions/string200',
                          },

                          username: {
                            $ref: '#/definitions/string100',
                          },

                          deviceIdentifierNumber: {
                            $ref: '#/definitions/string200',
                          },

                          internetProtocolAddress: {
                            $ref: '#/definitions/string200',
                          },

                          dateTimeOfOnlineSession: {
                            $ref: '#/definitions/zonedDateTime',
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
                              enum: [
                                5,

                                6,
                              ],
                            },

                            refId: {
                              $ref: '#/definitions/refId',
                            },

                            details: {
                              type: 'object',

                              additionalProperties: false,

                              properties: {
                                clientNumber: {
                                  $ref: '#/definitions/string100',
                                },

                                emailAddress: {
                                  $ref: '#/definitions/string200',
                                },

                                url: {
                                  $ref: '#/definitions/string200',
                                },

                                relationshipOfConductorCode: {
                                  $ref: '#/definitions/optionTypeCode',
                                },

                                relationshipOfConductorOther: {
                                  $ref: '#/definitions/string200',
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
                      $ref: '#/definitions/optionTypeCode',
                    },

                    dispositionOther: {
                      $ref: '#/definitions/string200',
                    },

                    amount: {
                      $ref: '#/definitions/currencyAmount',
                    },

                    currencyCode: {
                      $ref: '#/definitions/alpha3',
                    },

                    virtualCurrencyTypeCode: {
                      $ref: '#/definitions/string20',
                    },

                    virtualCurrencyTypeOther: {
                      $ref: '#/definitions/string200',
                    },

                    exchangeRate: {
                      $ref: '#/definitions/exchangeRate',
                    },

                    valueInCanadianDollars: {
                      $ref: '#/definitions/currencyAmount',
                    },

                    virtualCurrencyTransactionIds: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    sendingVirtualCurrencyAddresses: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    receivingVirtualCurrencyAddresses: {
                      type: 'array',

                      items: {
                        $ref: '#/definitions/string200',
                      },
                    },

                    referenceNumber: {
                      $ref: '#/definitions/string200',
                    },

                    referenceNumberOtherRelatedNumber: {
                      $ref: '#/definitions/string200',
                    },

                    account: {
                      $ref: '#/definitions/account',
                    },

                    accountStatusAtTimeOfTransaction: {
                      $ref: '#/definitions/optionTypeCode',
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
                        enum: [
                          1,

                          2,
                        ],
                      },

                      refId: {
                        $ref: '#/definitions/refId',
                      },

                      details: {
                        type: 'object',

                        additionalProperties: false,

                        properties: {
                          accountNumber: {
                            $ref: '#/definitions/string100',
                          },

                          identifyingNumber: {
                            $ref: '#/definitions/string100',
                          },

                          policyNumber: {
                            $ref: '#/definitions/string100',
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
                        enum: [
                          3,

                          4,
                        ],
                      },

                      refId: {
                        $ref: '#/definitions/refId',
                      },

                      details: {
                        type: 'object',

                        additionalProperties: false,

                        properties: {
                          clientNumber: {
                            $ref: '#/definitions/string100',
                          },

                          username: {
                            $ref: '#/definitions/string100',
                          },

                          emailAddress: {
                            $ref: '#/definitions/string200',
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
                enum: [
                  1,

                  2,

                  3,

                  4,

                  5,

                  6,
                ],
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
              $ref: '#/definitions/personName',
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
              $ref: '#/definitions/entityName',
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
              $ref: '#/definitions/personDetails',
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
              $ref: '#/definitions/entityDetails',
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
              $ref: '#/definitions/personAndEmployerDetails',
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
              $ref: '#/definitions/entityAndBeneficialOwnershipDetails',
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
          $ref: '#/definitions/refId',
        },

        givenName: {
          $ref: '#/definitions/string100',
        },

        surname: {
          $ref: '#/definitions/string100',
        },

        otherNameInitial: {
          $ref: '#/definitions/string100',
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
          $ref: '#/definitions/refId',
        },

        nameOfEntity: {
          $ref: '#/definitions/string100',
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
          $ref: '#/definitions/refId',
        },

        surname: {
          $ref: '#/definitions/string100',
        },

        givenName: {
          $ref: '#/definitions/string100',
        },

        otherNameInitial: {
          $ref: '#/definitions/string100',
        },

        alias: {
          $ref: '#/definitions/string100',
        },

        addressTypeCode: {
          enum: [
            1,

            2,
          ],
        },

        address: {
          oneOf: [
            {
              $ref: '#/definitions/structuredAddress',
            },

            {
              $ref: '#/definitions/unstructuredAddress',
            },
          ],
        },

        telephoneNumber: {
          $ref: '#/definitions/string20',
        },

        extensionNumber: {
          $ref: '#/definitions/string10',
        },

        dateOfBirth: {
          $ref: '#/definitions/localDate',
        },

        countryOfResidenceCode: {
          $ref: '#/definitions/alpha2',
        },

        occupation: {
          $ref: '#/definitions/string200',
        },

        nameOfEmployer: {
          $ref: '#/definitions/string100',
        },

        identifications: {
          type: 'array',

          items: {
            $ref: '#/definitions/identification',
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
          $ref: '#/definitions/refId',
        },

        nameOfEntity: {
          $ref: '#/definitions/string100',
        },

        addressTypeCode: {
          enum: [
            1,

            2,
          ],
        },

        address: {
          oneOf: [
            {
              $ref: '#/definitions/structuredAddress',
            },

            {
              $ref: '#/definitions/unstructuredAddress',
            },
          ],
        },

        telephoneNumber: {
          $ref: '#/definitions/string20',
        },

        extensionNumber: {
          $ref: '#/definitions/string10',
        },

        natureOfPrincipalBusiness: {
          $ref: '#/definitions/string200',
        },

        registrationIncorporationIndicator: {
          type: 'boolean',
        },

        registrationsIncorporations: {
          type: 'array',

          items: {
            $ref: '#/definitions/registrationIncorporation',
          },
        },

        identifications: {
          type: 'array',

          items: {
            $ref: '#/definitions/identification',
          },
        },

        authorizedPersons: {
          type: 'array',

          items: {
            $ref: '#/definitions/authorizedPerson',
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
          $ref: '#/definitions/refId',
        },

        surname: {
          $ref: '#/definitions/string100',
        },

        givenName: {
          $ref: '#/definitions/string100',
        },

        otherNameInitial: {
          $ref: '#/definitions/string100',
        },

        alias: {
          $ref: '#/definitions/string100',
        },

        addressTypeCode: {
          enum: [
            1,

            2,
          ],
        },

        address: {
          oneOf: [
            {
              $ref: '#/definitions/structuredAddress',
            },

            {
              $ref: '#/definitions/unstructuredAddress',
            },
          ],
        },

        telephoneNumber: {
          $ref: '#/definitions/string20',
        },

        extensionNumber: {
          $ref: '#/definitions/string10',
        },

        dateOfBirth: {
          $ref: '#/definitions/localDate',
        },

        countryOfResidenceCode: {
          $ref: '#/definitions/alpha2',
        },

        countryOfCitizenshipCode: {
          $ref: '#/definitions/alpha2',
        },

        occupation: {
          $ref: '#/definitions/string200',
        },

        employerInformation: {
          type: 'object',

          additionalProperties: false,

          properties: {
            name: {
              $ref: '#/definitions/string100',
            },

            addressTypeCode: {
              enum: [
                1,

                2,
              ],
            },

            address: {
              oneOf: [
                {
                  $ref: '#/definitions/structuredAddress',
                },

                {
                  $ref: '#/definitions/unstructuredAddress',
                },
              ],
            },

            telephoneNumber: {
              $ref: '#/definitions/string20',
            },

            extensionNumber: {
              $ref: '#/definitions/string10',
            },
          },
        },

        identifications: {
          type: 'array',

          items: {
            $ref: '#/definitions/identification',
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
          $ref: '#/definitions/refId',
        },

        nameOfEntity: {
          $ref: '#/definitions/string100',
        },

        addressTypeCode: {
          enum: [
            1,

            2,
          ],
        },

        address: {
          oneOf: [
            {
              $ref: '#/definitions/structuredAddress',
            },

            {
              $ref: '#/definitions/unstructuredAddress',
            },
          ],
        },

        telephoneNumber: {
          $ref: '#/definitions/string20',
        },

        extensionNumber: {
          $ref: '#/definitions/string10',
        },

        identifications: {
          type: 'array',

          items: {
            $ref: '#/definitions/identification',
          },
        },

        authorizedPersons: {
          type: 'array',

          items: {
            $ref: '#/definitions/authorizedPerson',
          },
        },

        structureTypeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        structureTypeOther: {
          $ref: '#/definitions/string200',
        },

        natureOfPrincipalBusiness: {
          $ref: '#/definitions/string200',
        },

        registrationIncorporationIndicator: {
          type: 'boolean',
        },

        registrationsIncorporations: {
          type: 'array',

          items: {
            $ref: '#/definitions/registrationIncorporation',
          },
        },

        directorsOfCorporation: {
          type: 'array',

          items: {
            $ref: '#/definitions/personContact',
          },
        },

        personsOwningSharesOfCorporation: {
          type: 'array',

          items: {
            type: 'object',

            additionalProperties: false,

            properties: {
              surname: {
                $ref: '#/definitions/string100',
              },

              givenName: {
                $ref: '#/definitions/string100',
              },

              otherNameInitial: {
                $ref: '#/definitions/string100',
              },
            },
          },
        },

        trusteesOfTrust: {
          type: 'array',

          items: {
            $ref: '#/definitions/personContact',
          },
        },

        settlorsOfTrust: {
          type: 'array',

          items: {
            $ref: '#/definitions/personContact',
          },
        },

        personsOwningUnitsOfTrust: {
          type: 'array',

          items: {
            $ref: '#/definitions/personContact',
          },
        },

        beneficiariesOfTrust: {
          type: 'array',

          items: {
            $ref: '#/definitions/personContact',
          },
        },

        personsOwningEntityNotCorporationOrTrust: {
          type: 'array',

          items: {
            type: 'object',

            additionalProperties: false,

            properties: {
              surname: {
                $ref: '#/definitions/string100',
              },

              givenName: {
                $ref: '#/definitions/string100',
              },

              otherNameInitial: {
                $ref: '#/definitions/string100',
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
          $ref: '#/definitions/string10',
        },

        buildingNumber: {
          $ref: '#/definitions/string10',
        },

        streetAddress: {
          $ref: '#/definitions/string100',
        },

        city: {
          $ref: '#/definitions/string100',
        },

        district: {
          $ref: '#/definitions/string100',
        },

        provinceStateCode: {
          $ref: '#/definitions/alpha2',
        },

        provinceStateName: {
          $ref: '#/definitions/string100',
        },

        subProvinceSubLocality: {
          $ref: '#/definitions/string100',
        },

        postalZipCode: {
          $ref: '#/definitions/string20',
        },

        countryCode: {
          $ref: '#/definitions/alpha2',
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
          $ref: '#/definitions/alpha2',
        },

        unstructured: {
          $ref: '#/definitions/string500',
        },
      },

      required: ['typeCode', 'unstructured'],
    },

    personContact: {
      type: 'object',

      additionalProperties: false,

      properties: {
        surname: {
          $ref: '#/definitions/string100',
        },

        givenName: {
          $ref: '#/definitions/string100',
        },

        otherNameInitial: {
          $ref: '#/definitions/string100',
        },

        addressTypeCode: {
          enum: [
            1,

            2,
          ],
        },

        address: {
          oneOf: [
            {
              $ref: '#/definitions/structuredAddress',
            },

            {
              $ref: '#/definitions/unstructuredAddress',
            },
          ],
        },

        telephoneNumber: {
          $ref: '#/definitions/string20',
        },

        extensionNumber: {
          $ref: '#/definitions/string10',
        },
      },
    },

    identification: {
      type: 'object',

      additionalProperties: false,

      properties: {
        identifierTypeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        identifierTypeOther: {
          $ref: '#/definitions/string200',
        },

        number: {
          $ref: '#/definitions/string100',
        },

        jurisdictionOfIssueCountryCode: {
          $ref: '#/definitions/alpha2',
        },

        jurisdictionOfIssueProvinceStateCode: {
          $ref: '#/definitions/alpha2',
        },

        jurisdictionOfIssueProvinceStateName: {
          $ref: '#/definitions/string100',
        },
      },
    },

    authorizedPerson: {
      type: 'object',

      additionalProperties: false,

      properties: {
        surname: {
          $ref: '#/definitions/string100',
        },

        givenName: {
          $ref: '#/definitions/string100',
        },

        otherNameInitial: {
          $ref: '#/definitions/string100',
        },
      },
    },

    registrationIncorporation: {
      type: 'object',

      additionalProperties: false,

      properties: {
        typeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        number: {
          $ref: '#/definitions/string100',
        },

        jurisdictionOfIssueCountryCode: {
          $ref: '#/definitions/alpha2',
        },

        jurisdictionOfIssueProvinceStateCode: {
          $ref: '#/definitions/alpha2',
        },

        jurisdictionOfIssueProvinceStateName: {
          $ref: '#/definitions/string100',
        },
      },
    },

    account: {
      type: 'object',

      additionalProperties: false,

      properties: {
        financialInstitutionNumber: {
          $ref: '#/definitions/string50',
        },

        branchNumber: {
          $ref: '#/definitions/string50',
        },

        number: {
          $ref: '#/definitions/string100',
        },

        typeCode: {
          $ref: '#/definitions/optionTypeCode',
        },

        typeOther: {
          $ref: '#/definitions/string200',
        },

        currencyCode: {
          $ref: '#/definitions/alpha3',
        },

        virtualCurrencyTypeCode: {
          $ref: '#/definitions/string20',
        },

        virtualCurrencyTypeOther: {
          $ref: '#/definitions/string200',
        },

        dateOpened: {
          $ref: '#/definitions/localDate',
        },

        dateClosed: {
          $ref: '#/definitions/localDate',
        },

        holders: {
          type: 'array',

          items: {
            type: 'object',

            additionalProperties: false,

            properties: {
              typeCode: {
                enum: [
                  1,

                  2,
                ],
              },

              refId: {
                $ref: '#/definitions/refId',
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
