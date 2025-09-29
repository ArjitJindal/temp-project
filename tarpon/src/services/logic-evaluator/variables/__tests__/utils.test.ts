import { EntityLeafValueInfo, getPublicModelLeafAttrs } from '../utils'
import { User } from '@/@types/openapi-public/User'
import { Transaction } from '@/@types/openapi-public/Transaction'

describe('getPublicModelLeafAttrs', () => {
  test('Transaction', async () => {
    const result = getPublicModelLeafAttrs(Transaction)
    const expected: EntityLeafValueInfo[] = [
      {
        path: [{ key: 'transactionId' }],
        pathKey: 'transactionId',
        type: 'string',
      },
      {
        path: [{ key: 'timestamp' }],
        pathKey: 'timestamp',
        type: 'number',
      },
      {
        path: [{ key: 'transactionState' }],
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
        path: [{ key: 'originAmountDetails' }, { key: 'transactionAmount' }],
        pathKey: 'originAmountDetails.transactionAmount',
        type: 'number',
      },
      {
        path: [{ key: 'originAmountDetails' }, { key: 'transactionCurrency' }],
        pathKey: 'originAmountDetails.transactionCurrency',
        type: 'string',
        options: expect.arrayContaining([
          {
            title: 'USD (United States dollar)',
            value: 'USD',
          },
          {
            title: 'EUR (Euro)',
            value: 'EUR',
          },
        ]),
      },
      {
        path: [
          { key: 'originPaymentDetails', oneOfSubtype: 'CardDetails' },
          { key: 'method' },
        ],
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
        path: [
          { key: 'originPaymentDetails', oneOfSubtype: 'CardDetails' },
          { key: 'cardFingerprint' },
        ],
        pathKey: 'originPaymentDetails.cardFingerprint',
        type: 'string',
      },
      {
        path: [
          { key: 'originPaymentDetails', oneOfSubtype: 'CardDetails' },
          { key: '3dsDone' },
        ],
        pathKey: 'originPaymentDetails.3dsDone',
        type: 'boolean',
      },
      {
        path: [
          { key: 'originPaymentDetails', oneOfSubtype: 'CardDetails' },
          { key: 'tags' },
          { isArray: true },
          { key: 'key' },
        ],
        pathKey: 'originPaymentDetails.tags.$i.key',
        type: 'string',
      },
      {
        path: [
          { key: 'originPaymentDetails', oneOfSubtype: 'CardDetails' },
          { key: 'tags' },
          { isArray: true },
          { key: 'value' },
        ],
        pathKey: 'originPaymentDetails.tags.$i.value',
        type: 'string',
      },
    ]
    expect(result).toEqual(expect.arrayContaining(expected))
  })
  test('Consumer user', async () => {
    const result = getPublicModelLeafAttrs(User)
    const expected: EntityLeafValueInfo[] = [
      {
        path: [{ key: 'userId' }],
        pathKey: 'userId',
        type: 'string',
      },
      {
        path: [
          { key: 'legalDocuments' },
          { isArray: true },
          { key: 'documentType' },
        ],
        pathKey: 'legalDocuments.$i.documentType',
        type: 'string',
      },
      {
        path: [
          { key: 'legalDocuments' },
          { isArray: true },
          { key: 'tags' },
          { isArray: true },
          { key: 'key' },
        ],
        pathKey: 'legalDocuments.$i.tags.$i.key',
        type: 'string',
      },
    ]
    expect(result).toEqual(expect.arrayContaining(expected))
  })
})
