import { TestApiEvent, TestApiRequestContext } from './types'
import { Transaction } from '@/@types/openapi-public/Transaction'
export const event: TestApiEvent = {
  resource: '/transactions',
  path: '/transactions',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  stageVariables: null,
  body: JSON.stringify({
    originUserId: '8650a2611d0771cba03310f74bf6',
    originAmountDetails: {
      country: 'DE',
      transactionAmount: 800,
      transactionCurrency: 'EUR',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    timestamp: 1641654664,
    originPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'US',
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    reference: 'loan repayment',
    deviceData: {
      batteryLevel: 95,
      deviceLatitude: 13.0033,
      deviceLongitude: 76.1004,
      ipAddress: '10.23.191.2',
      deviceIdentifier: '3c49f915d04485e34caba',
      vpnUsed: false,
      operatingSystem: 'Android 11.2',
      deviceMaker: 'ASUS',
      deviceModel: 'Zenphone M2 Pro Max',
      deviceYear: '2018',
      appVersion: '1.1.0',
    },
    tags: [
      {
        key: 'customKey',
        value: 'customValue',
      },
    ],
  } as Transaction),
}
