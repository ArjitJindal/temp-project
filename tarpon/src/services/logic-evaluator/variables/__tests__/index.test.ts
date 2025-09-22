import fs from 'fs'
import path from 'path'
import omit from 'lodash/omit'
import { getTransactionLogicEntityVariables, getLogicVariableByKey } from '..'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { SourceOfFunds } from '@/@types/openapi-public/SourceOfFunds'

describe('List of entity variables', () => {
  test('schema', async () => {
    const entityVariables = Object.values(
      getTransactionLogicEntityVariables()
    ).map((v) => omit(v, 'load'))

    expect(entityVariables).toEqual(
      expect.arrayContaining([
        {
          key: 'TRANSACTION:type',
          entity: 'TRANSACTION',
          valueType: 'string',
          sourceField: 'type',
          uiDefinition: {
            label: 'Transaction / type',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
              allowNewValues: true,
              uniqueType: 'TRANSACTION_TYPES',
              allowCustomValues: true,
              listValues: expect.arrayContaining([
                {
                  title: 'Deposit',
                  value: 'DEPOSIT',
                },
                {
                  title: 'Transfer',
                  value: 'TRANSFER',
                },
              ]),
            },
          },
        },
        {
          key: 'TRANSACTION:transactionId',
          entity: 'TRANSACTION',
          valueType: 'string',
          sourceField: 'transactionId',
          uiDefinition: {
            label: 'Transaction / transaction id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
        {
          key: 'TRANSACTION:originAmountDetails-transactionCurrency',
          entity: 'TRANSACTION',
          valueType: 'string',
          sourceField: 'originAmountDetails',
          uiDefinition: {
            label: 'Transaction / origin amount details > transaction currency',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
              allowCustomValues: true,
              listValues: expect.arrayContaining([
                {
                  title: 'EUR (Euro)',
                  value: 'EUR',
                },
              ]),
            },
          },
        },
        {
          key: 'CONSUMER_USER:userDetails-dateOfBirth__SENDER',
          entity: 'CONSUMER_USER',
          valueType: 'string',
          uiDefinition: {
            label: 'Consumer User / user details > date of birth',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
        {
          key: 'CONSUMER_USER:userDetails-countryOfResidence__RECEIVER',
          entity: 'CONSUMER_USER',
          valueType: 'string',
          uiDefinition: {
            label: 'Consumer User / user details > country of residence',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
              listValues: expect.arrayContaining([
                {
                  title: 'Germany (DE)',
                  value: 'DE',
                },
              ]),
              allowCustomValues: true,
            },
          },
        },
        {
          key: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER',
          entity: 'BUSINESS_USER',
          valueType: 'string',
          uiDefinition: {
            label:
              'Business User / legal entity > company general details > user segment',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
              allowCustomValues: true,
              listValues: expect.arrayContaining([
                {
                  title: 'Sole Proprietorship',
                  value: 'SOLE_PROPRIETORSHIP',
                },
                {
                  title: 'Limited',
                  value: 'LIMITED',
                },
              ]),
            },
          },
        },
        {
          key: 'TRANSACTION:tags',
          entity: 'TRANSACTION',
          valueType: 'array',
          uiDefinition: {
            label: 'Transaction / tags',
            type: '!group',
            mode: 'array',
            conjunctions: ['AND', 'OR'],
            subfields: {
              key: {
                label: 'key',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
                fieldSettings: {
                  allowCustomValues: true,
                  uniqueType: 'TAGS_KEY',
                  allowNewValues: true,
                },
              },
              value: {
                label: 'value',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
                fieldSettings: {
                  allowCustomValues: true,
                  uniqueType: 'TAGS_VALUE',
                  allowNewValues: true,
                },
              },
              isTimestamp: {
                label: 'is timestamp',
                type: 'boolean',
                valueSources: ['value', 'field', 'func'],
              },
            },
          },
          sourceField: 'tags',
        },
        {
          key: 'CONSUMER_USER:legalDocuments__SENDER',
          entity: 'CONSUMER_USER',
          valueType: 'array',
          uiDefinition: {
            label: 'Consumer User / legal documents',
            type: '!group',
            mode: 'array',
            conjunctions: ['AND', 'OR'],
            subfields: {
              documentType: {
                label: 'document type',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
              documentNumber: {
                label: 'document number',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
              documentIssuedDate: {
                label: 'document issued date',
                type: 'datetime',
                valueSources: ['value', 'field', 'func'],
              },
              documentExpirationDate: {
                label: 'document expiration date',
                type: 'datetime',
                valueSources: ['value', 'field', 'func'],
              },
              documentIssuedCountry: {
                label: 'document issued country',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
                fieldSettings: {
                  listValues: expect.arrayContaining([
                    {
                      title: 'Germany (DE)',
                      value: 'DE',
                    },
                  ]),
                  allowCustomValues: true,
                },
              },
              'nameOnDocument.firstName': {
                label: 'name on document > first name',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
              'nameOnDocument.middleName': {
                label: 'name on document > middle name',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
              'nameOnDocument.lastName': {
                label: 'name on document > last name',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
              tags: {
                label: 'tags',
                type: '!group',
                mode: 'array',
                conjunctions: ['AND', 'OR'],
                subfields: {
                  key: {
                    label: 'key',
                    type: 'text',
                    valueSources: ['value', 'field', 'func'],
                  },
                  value: {
                    label: 'value',
                    type: 'text',
                    valueSources: ['value', 'field', 'func'],
                  },
                  isTimestamp: {
                    label: 'is timestamp',
                    type: 'boolean',
                    valueSources: ['value', 'field', 'func'],
                  },
                },
              },
            },
          },
        },
      ])
    )
  })

  // NOTE: Changing the key of an entity variable requires a migration
  test('keys', async () => {
    const entityVariableKeys = Object.values(
      getTransactionLogicEntityVariables()
    ).map((v) => v.key)

    const variables = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'resources', 'entity-variables.json'),
        'utf8'
      )
    )
    expect(entityVariableKeys).toEqual(variables)
  })
})

describe('Auto-created entity variables', () => {
  test('TRANSACTION:type', async () => {
    const variable = getLogicVariableByKey('TRANSACTION:type')
    expect(await variable?.load(getTestTransaction({ type: 'REFUND' }))).toBe(
      'REFUND'
    )
  })
  test('TRANSACTION:originAmountDetails-transactionCurrency', async () => {
    const variable = getLogicVariableByKey(
      'TRANSACTION:originAmountDetails-transactionCurrency'
    )
    expect(
      await variable?.load(
        getTestTransaction({
          originAmountDetails: {
            transactionCurrency: 'JPY',
            transactionAmount: 100,
          },
        })
      )
    ).toBe('JPY')
  })
  test('CONSUMER_USER:userDetails-dateOfBirth__SENDER', async () => {
    const variable = await getLogicVariableByKey(
      'CONSUMER_USER:userDetails-dateOfBirth__SENDER'
    )
    expect(
      await variable?.load(
        getTestUser({
          userDetails: {
            dateOfBirth: '1990-01-01',
            name: { firstName: 'foo', lastName: 'bar' },
          },
        })
      )
    ).toBe('1990-01-01')
  })
  test('BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER', async () => {
    const variable = await getLogicVariableByKey(
      'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER'
    )
    expect(
      await variable?.load(
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: { legalName: 'foo', userSegment: 'LIMITED' },
          },
        })
      )
    ).toBe('LIMITED')
  })
  test('TRANSACTION:tags', async () => {
    const variable = getLogicVariableByKey('TRANSACTION:tags')
    const data = await variable?.load(
      getTestTransaction({
        tags: [
          { key: 'k1', value: 'v1' },
          { key: 'k2', value: 'v2' },
        ],
      })
    )
    expect(data).toEqual([
      { key: 'k1', value: 'v1' },
      { key: 'k2', value: 'v2' },
    ])
  })

  test('TRANSACTION:relatedTransactionIds', async () => {
    const variable = getLogicVariableByKey('TRANSACTION:relatedTransactionIds')
    const relatedTransactionIds = ['T-1', 'T-2']
    expect(
      await variable?.load(
        getTestTransaction({ relatedTransactionIds: relatedTransactionIds })
      )
    ).toBe(relatedTransactionIds)
  })

  test('CONSUMER_USER:contactDetails-emailIds__SENDER', async () => {
    const variable = getLogicVariableByKey(
      'CONSUMER_USER:contactDetails-emailIds__SENDER'
    )
    const emailIds = ['abc@email.com', 'xyz@email.com']
    expect(
      await variable?.load(
        getTestUser({
          contactDetails: {
            emailIds: emailIds,
          },
        })
      )
    ).toBe(emailIds)
  })

  test('CONSUMER_USER:contactDetails-contactNumbers__SENDER', async () => {
    const variable = getLogicVariableByKey(
      'CONSUMER_USER:contactDetails-contactNumbers__SENDER'
    )
    const phoneNumbers = ['1234567890', '0987654321']
    expect(
      await variable?.load(
        getTestUser({
          contactDetails: {
            contactNumbers: phoneNumbers,
          },
        })
      )
    ).toBe(phoneNumbers)
  })

  test('CONSUMER_USER:savedPaymentDetails__SENDER', async () => {
    const variable = getLogicVariableByKey(
      'CONSUMER_USER:savedPaymentDetails__SENDER'
    )

    const savedPaymentDetails: CardDetails[] = [
      {
        method: 'CARD',
        cardType: 'PHYSICAL',
        cardBrand: 'VISA',
      },
    ]

    expect(
      await variable?.load(
        getTestUser({
          savedPaymentDetails: savedPaymentDetails,
        })
      )
    ).toBe(savedPaymentDetails)
  })
  test('CONSUMER_USER:sourceOfFunds__SENDER', async () => {
    const variable = getLogicVariableByKey(
      'CONSUMER_USER:sourceOfFunds__SENDER'
    )

    const sourceOfFunds: SourceOfFunds[] = ['Business', 'Benefits']

    expect(
      await variable?.load(
        getTestUser({
          sourceOfFunds: sourceOfFunds,
        })
      )
    ).toBe(sourceOfFunds)
  })
})
