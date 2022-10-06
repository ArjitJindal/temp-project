import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/consumer',
  path: '/consumer/users',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  stageVariables: null,
  body: JSON.stringify({
    userId: '96647cfd9e8fe66ee0f3362e011e34e8',
    userDetails: {
      name: {
        firstName: 'Baran',
        middleName: 'Realblood',
        lastName: 'Ozkan',
      },
      dateOfBirth: 0,
      age: 0,
      countryOfResidence: 'US',
      countryOfNationality: 'DE',
    },
    legalDocuments: [
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedDate: 1639939034000,
        documentExpirationDate: 1839939034000,
        documentIssuedCountry: 'DE',
        tags: [
          {
            key: 'customerType',
            value: 'wallet',
          },
        ],
      },
    ],
    contactDetails: {
      emailIds: ['baran@flagright.com'],
      contactNumbers: ['+37112345432'],
      websites: ['flagright.com'],
      addresses: [
        {
          addressLines: ['Klara-Franke Str 20'],
          postcode: '10557',
          city: 'Berlin',
          state: 'Berlin',
          country: 'Germany',
          tags: [
            {
              key: 'customKey',
              value: 'customValue',
            },
          ],
        },
      ],
    },
    tags: [
      {
        key: 'customKey',
        value: 'customValue',
      },
    ],
  }),
}
