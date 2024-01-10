import { omit } from 'lodash'
import { getAllRuleEntityVariables, getRuleVariableByKey } from '..'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

test('List of entity variables', async () => {
  const entityVariables = (await getAllRuleEntityVariables()).map((v) =>
    omit(v, 'load')
  )
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
                title: '1 Inch',
                value: '1INCH',
              },
              {
                title: 'Aave',
                value: 'AAVE',
              },
            ]),
          },
        },
      },
      {
        key: 'CONSUMER_USER:userDetails-dateOfBirth',
        entity: 'CONSUMER_USER',
        valueType: 'string',
        uiDefinition: {
          label: 'Consumer User / user details > date of birth',
          type: 'text',
          valueSources: ['value', 'field', 'func'],
        },
      },
      {
        key: 'CONSUMER_USER:userDetails-countryOfResidence',
        entity: 'CONSUMER_USER',
        valueType: 'string',
        uiDefinition: {
          label: 'Consumer User / user details > country of residence',
          type: 'select',
          valueSources: ['value', 'field', 'func'],
          fieldSettings: {
            listValues: expect.arrayContaining([
              {
                title: 'Af',
                value: 'AF',
              },
              {
                title: 'Al',
                value: 'AL',
              },
            ]),
          },
        },
      },
      {
        key: 'BUSINESS_USER:legalEntity-companyGeneralDetails-businessIndustry-$i',
        entity: 'BUSINESS_USER',
        valueType: 'string',
        uiDefinition: {
          label:
            'Business User / legal entity > company general details > business industry > i',
          type: 'text',
          valueSources: ['value', 'field', 'func'],
        },
      },
      {
        key: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment',
        entity: 'BUSINESS_USER',
        valueType: 'string',
        uiDefinition: {
          label:
            'Business User / legal entity > company general details > user segment',
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
    ])
  )
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
  test('CONSUMER_USER:userDetails-dateOfBirth', async () => {
    const variable = (await getRuleVariableByKey(
      'CONSUMER_USER:userDetails-dateOfBirth'
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
  test('BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment', async () => {
    const variable = (await getRuleVariableByKey(
      'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment'
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
})
