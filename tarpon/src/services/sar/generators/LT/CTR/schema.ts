import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
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
                required: ['ItemDirection', 'PersonClass', 'Country'],
                properties: {
                  ItemDirection: {
                    type: 'string',
                    enum: ['GIVER', 'RECEIVER'],
                    enumNames: ['Giver', 'Receiver'],
                  },
                  PersonClass: {
                    type: 'string',
                    enum: ['1', '2'],
                    enumNames: ['Natural person', 'Legal entity'],
                  },
                  Title: { type: 'string' },
                  FirstName: { type: 'string' },
                  LastName: { type: 'string' },
                  Code: { type: 'string' },
                  Address: { type: 'string' },
                  Country: { type: 'string', enum: COUNTRY_CODES },
                  DocumentNumber: { type: 'string' },
                  DocumentIssueDate: { format: 'date', type: 'string' },
                  Delegate: {
                    type: 'object',
                    required: ['FirstName', 'LastName', 'Country'],
                    properties: {
                      FirstName: { type: 'string' },
                      LastName: { type: 'string' },
                      Code: { type: 'string' },
                      Address: { type: 'string' },
                      Country: { type: 'string', enum: COUNTRY_CODES },
                      Mandate: {
                        type: 'object',
                        required: ['Number', 'IssueDate'],
                        properties: {
                          Number: { type: 'string' },
                          IssueDate: { format: 'date', type: 'string' },
                        },
                      },
                    },
                  },
                  OperationValue: {
                    type: 'object',
                    properties: {
                      Sum: { type: 'number' },
                      Currency: { type: 'string', enum: CURRENCY_CODES },
                    },
                    required: ['Sum', 'Currency'],
                  },
                  Account: {
                    title: 'Account',
                    type: 'object',
                    required: ['Bank', 'IBAN', 'AccountOwner'],
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
