import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'

export const schema = {
  type: 'object',
  properties: {
    SuspiciousTransactionReport: {
      type: 'object',
      properties: {
        Provider: {
          'ui:schema': {
            'ui:group': 'Provider',
          },
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
        StrData: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'TransactionDate',
              'ReportNumber',
              'ReportType',
              'OperationType',
              'Suspicion',
              'TransactionValue',
              'TransactionSubject',
              'Account',
            ],
            properties: {
              TransactionDate: { format: 'date', type: 'string' },
              ReportNumber: { type: 'string' },
              RelatedReports: { type: 'string' },
              ReportType: { type: 'string' },
              OperationType: { type: 'string' },
              StopDate: { format: 'date', type: 'string' },
              NonStopReason: { type: 'string' },
              Description: { type: 'string' },
              Suspicion: {
                type: 'object',
                required: ['SuspicionCode', 'SuspicionTitle'],
                properties: {
                  SuspicionCode: { type: 'string' },
                  SuspicionTitle: { type: 'string' },
                },
              },
              TransactionValue: {
                type: 'object',
                required: ['Sum', 'Currency'],
                properties: {
                  Sum: { type: 'number' },
                  Currency: { type: 'string', enum: CURRENCY_CODES },
                  StoppingDate: { format: 'date', type: 'string' },
                },
              },
              TransactionSubject: {
                type: 'object',
                properties: {
                  SubjectType: { type: 'string' },
                  Country: { type: 'string' },
                  Citizenship: { type: 'string' },
                  Code: { type: 'string' },
                  BirthDate: { format: 'date', type: 'string' },
                  Title: { type: 'string' },
                  FirstName: { type: 'string' },
                  LastName: { type: 'string' },
                  DocumentType: { type: 'string' },
                  DocumentNumber: { type: 'string' },
                  DocumentIssueDate: { format: 'date', type: 'string' },
                  Address: { type: 'string' },
                  PhoneNumber: { type: 'string' },
                  MainActivity: { type: 'string' },
                },
              },
              Account: {
                type: 'object',
                properties: {
                  Bank: { type: 'string' },
                  IBAN: { type: 'string' },
                  AccountOwner: { type: 'string' },
                  OpeningDate: { format: 'date', type: 'string' },
                  ClosingDate: { format: 'date', type: 'string' },
                  OtherInformation: { type: 'string' },
                  SubjectCode: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
}
