import { getPublicModelLeafAttrs } from '../utils'
import { Transaction } from '@/@types/openapi-public/Transaction'

describe('getPublicModelLeafAttrs', () => {
  test('Transaction', async () => {
    const result = getPublicModelLeafAttrs(Transaction)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          path: ['transactionId'],
          pathKey: 'transactionId',
          type: 'string',
        },
        {
          path: ['timestamp'],
          pathKey: 'timestamp',
          type: 'number',
        },
        {
          path: ['transactionState'],
          pathKey: 'transactionState',
          type: 'string',
          options: expect.arrayContaining([
            {
              title: 'Created',
              value: 'CREATED',
            },
            {
              title: 'Processing',
              value: 'PROCESSING',
            },
          ]),
        },
        {
          path: ['originAmountDetails', 'transactionAmount'],
          pathKey: 'originAmountDetails.transactionAmount',
          type: 'number',
        },
        {
          path: ['originAmountDetails', 'transactionCurrency'],
          pathKey: 'originAmountDetails.transactionCurrency',
          type: 'string',
          options: expect.arrayContaining([
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
        {
          path: ['originPaymentDetails', 'method'],
          pathKey: 'originPaymentDetails.method',
          type: 'string',
          options: expect.arrayContaining([
            {
              title: 'Card',
              value: 'CARD',
            },
            {
              title: 'Generic Bank Account',
              value: 'GENERIC_BANK_ACCOUNT',
            },
          ]),
        },
        {
          path: ['originPaymentDetails', 'cardFingerprint'],
          pathKey: 'originPaymentDetails.cardFingerprint',
          type: 'string',
        },
        {
          path: ['originPaymentDetails', '3dsDone'],
          pathKey: 'originPaymentDetails.3dsDone',
          type: 'boolean',
        },
        {
          path: ['originPaymentDetails', 'tags', '$i', 'key'],
          pathKey: 'originPaymentDetails.tags.$i.key',
          type: 'string',
        },
        {
          path: ['originPaymentDetails', 'tags', '$i', 'value'],
          pathKey: 'originPaymentDetails.tags.$i.value',
          type: 'string',
        },
      ])
    )
  })
})
