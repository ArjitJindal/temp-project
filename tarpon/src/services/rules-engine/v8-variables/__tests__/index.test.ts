import fs from 'fs'
import path from 'path'
import { omit } from 'lodash'
import { getTransactionRuleEntityVariables, getRuleVariableByKey } from '..'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

describe('List of entity variables', () => {
  test('schema', async () => {
    const entityVariables = Object.values(
      getTransactionRuleEntityVariables()
    ).map((v) => omit(v, 'load'))
    expect(entityVariables).toEqual(
      expect.arrayContaining([
        {
          key: 'TRANSACTION:type',
          entity: 'TRANSACTION',
          valueType: 'string',
          uiDefinition: {
            label: 'Transaction / type',
            type: 'select',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
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
          uiDefinition: {
            label: 'Transaction / origin amount details > transaction currency',
            type: 'select',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
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
            label: 'Consumer User / user details > date of birth (Sender)',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
        {
          key: 'CONSUMER_USER:userDetails-countryOfResidence__RECEIVER',
          entity: 'CONSUMER_USER',
          valueType: 'string',
          uiDefinition: {
            label:
              'Consumer User / user details > country of residence (Receiver)',
            type: 'select',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
              listValues: expect.arrayContaining([
                {
                  title: 'Germany (DE)',
                  value: 'DE',
                },
              ]),
            },
          },
        },
        {
          key: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER',
          entity: 'BUSINESS_USER',
          valueType: 'string',
          uiDefinition: {
            label:
              'Business User / legal entity > company general details > user segment (Sender)',
            type: 'select',
            valueSources: ['value', 'field', 'func'],
            fieldSettings: {
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
              },
              value: {
                label: 'value',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
            },
          },
        },
        {
          key: 'CONSUMER_USER:legalDocuments__SENDER',
          entity: 'CONSUMER_USER',
          valueType: 'array',
          uiDefinition: {
            label: 'Consumer User / legal documents (Sender)',
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
                type: 'number',
                valueSources: ['value', 'field', 'func'],
              },
              documentExpirationDate: {
                label: 'document expiration date',
                type: 'number',
                valueSources: ['value', 'field', 'func'],
              },
              documentIssuedCountry: {
                label: 'document issued country',
                type: 'select',
                valueSources: ['value', 'field', 'func'],
                fieldSettings: {
                  listValues: expect.arrayContaining([
                    {
                      title: 'Germany (DE)',
                      value: 'DE',
                    },
                  ]),
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
      getTransactionRuleEntityVariables()
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
    const variable = getRuleVariableByKey('TRANSACTION:type')!
    expect(await variable.load(getTestTransaction({ type: 'REFUND' }))).toBe(
      'REFUND'
    )
  })
  test('TRANSACTION:originAmountDetails-transactionCurrency', async () => {
    const variable = getRuleVariableByKey(
      'TRANSACTION:originAmountDetails-transactionCurrency'
    )!
    expect(
      await variable.load(
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
    const variable = (await getRuleVariableByKey(
      'CONSUMER_USER:userDetails-dateOfBirth__SENDER'
    ))!
    expect(
      await variable.load(
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
    const variable = (await getRuleVariableByKey(
      'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER'
    ))!
    expect(
      await variable.load(
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: { legalName: 'foo', userSegment: 'LIMITED' },
          },
        })
      )
    ).toBe('LIMITED')
  })
  test('TRANSACTION:tags', async () => {
    const variable = getRuleVariableByKey('TRANSACTION:tags')!
    const data = await variable.load(
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
})
