import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'
import { transactionTypes } from '@/services/sar/generators/LT/common'

export const schema = {
  type: 'object',
  properties: {
    CashTransactionReport: {
      type: 'object',
      properties: {
        Provider: {
          title: 'Provider Code',
          type: 'object',
          required: ['Code'],
          properties: {
            Code: {
              'ui:schema': {
                'ui:group': 'Provider',
              },
              type: 'array',
              items: { type: 'string', maxLength: 20 },
            },
          },
        },
        CtrData: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'TransactionDate',
              'TransactionType',
              'RegistrationNumber',
              'TransactionValue',
              'OperationType',
              'OperationDataItem',
              'OperationValue',
              'Account',
            ],
            properties: {
              TransactionDate: { format: 'date', type: 'string' },
              TransactionType: {
                type: 'string',
                enum: transactionTypes.map((t) => t[0]),
                enumNames: transactionTypes.map((t) => t[1]),
              },
              RegistrationNumber: { type: 'string' },
              TransactionValue: {
                type: 'object',
                required: ['Sum', 'Currency'],
                properties: {
                  Sum: { type: 'number' },
                  Currency: { type: 'string', enum: CURRENCY_CODES },
                },
              },
              OperationType: { type: 'string' },
              OperationDataItem: {
                type: 'object',
                properties: {
                  ItemDirection: { type: 'string' },
                  PersonClass: { type: 'string' },
                  Title: { type: 'string' },
                  FirstName: { type: 'string' },
                  LastName: { type: 'string' },
                  Code: { type: 'string' },
                  Address: { type: 'string' },
                  Country: { type: 'string' },
                  DocumentNumber: { type: 'string' },
                  DocumentIssueDate: { format: 'date', type: 'string' },
                  // Delegate: {
                  //   type: 'object',
                  //   properties: {
                  //     FirstName: { type: 'string' },
                  //     LastName: { type: 'string' },
                  //     Code: { type: 'string' },
                  //     Address: { type: 'string' },
                  //     Country: { type: 'string' },
                  //     Mandate: {
                  //       type: 'object',
                  //       properties: {
                  //         Number: { type: 'string' },
                  //         IssueDate: { format: 'date', type: 'string' },
                  //       },
                  //     },
                  //   },
                  // },
                  OperationValue: {
                    type: 'object',
                    properties: {
                      Sum: { type: 'number' },
                      Currency: { type: 'string', enum: CURRENCY_CODES },
                    },
                  },
                  Account: {
                    title: 'Account',
                    type: 'object',
                    properties: {
                      Bank: { type: 'string' },
                      IBAN: { type: 'string' },
                      AccountOwner: { type: 'string' },
                    },
                  },
                },
              },
              Comments: { type: 'string' },
            },
          },
        },
      },
    },
  },
}
