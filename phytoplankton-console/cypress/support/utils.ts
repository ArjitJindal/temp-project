export function getBaseUrl() {
  const client_id = getClientId();
  const env = client_id === Cypress.env('local_auth0_client_id') ? 'local' : 'dev';
  return env === 'local' ? 'http://localhost:3002/' : 'https://api.flagright.dev/console/';
}

export function getBaseApiUrl() {
  const client_id = getClientId();
  const env = client_id === Cypress.env('local_auth0_client_id') ? 'local' : 'dev';
  return env === 'local' ? 'http://localhost:3000/' : 'https://api.flagright.dev/';
}

export function getAuthTokenKey() {
  const authTokenKeyRegex = /@@auth0spajs@@::(.+)::(.+)::(.+)/;
  const localStorage = { ...window.localStorage };
  return Object.keys(localStorage).find((key) => authTokenKeyRegex.test(key));
}

export function getClientId() {
  const authTokenKey = getAuthTokenKey();
  return authTokenKey ? authTokenKey.split('::')[1] : null;
}

export function getAccessToken(authTokenKey) {
  const localStorage = { ...window.localStorage };
  const accessToken = authTokenKey
    ? JSON.parse(localStorage[authTokenKey]).body.access_token
    : null;
  return accessToken;
}

export function generateTransactionRequestBody(
  transactionId: string,
  originUserId: string,
  destinationUserId: string,
): any {
  return {
    transactionId: `${transactionId}`,
    type: 'TRANSFER',
    timestamp: Date.now(),
    originAmountDetails: {
      country: 'US',
      transactionAmount: 1000000,
      transactionCurrency: 'USD',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    originPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
      accountType: 'Savings',
      accountNumber: '121445521',
      bankName: 'State Bank of India',
      name: 'Binod Ramamurthie',
      bankCode: 'SBI0033921',
      specialInstructions: 'IMPS',
      paymentChannel: 'Intra Bank',
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: '000000000000',
      cardIssuedCountry: 'CN',
      cardAuthenticated: false,
      cardLast4Digits: '0019',
      cardBrand: 'DISCOVER',
      cardFunding: 'CREDIT',
    },
    originUserId,
    destinationUserId,
    reference: 'dog',
    tags: [{ key: 'flowType', value: 'wallet' }],
  };
}

export function generateUserRequestBody(userId: string): any {
  return {
    createdTimestamp: Date.now(),
    userId: `${userId}`,
    reasonForAccountOpening: ['Gasoline'],
    riskLevel: 'MEDIUM',
    userDetails: {
      name: {
        firstName: 'Jordie',
        lastName: 'Alba',
      },
      dateOfBirth: '1987-11-12',
      countryOfResidence: 'GB',
      countryOfNationality: 'DE',
    },
    legalDocuments: [
      {
        documentType: 'passport',
        documentNumber: 'CB33GME6',
        documentIssuedDate: 1639939034000,
        documentExpirationDate: 1839939034000,
        documentIssuedCountry: 'DE',
      },
    ],
  };
}

export function getCleanText(text: string): string {
  return text.replace(/[-*\n*]/g, '').replace(/\s+/g, '');
}
