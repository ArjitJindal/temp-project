export const event = {
  resource: '/lists',
  path: '/lists',
  httpMethod: 'POST',
  headers: {},
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  stageVariables: null,
  body: JSON.stringify({
    listName: 'countryriskscore',
    indexName: 'codeAlpha2',
    data: `name,codeAlpha2,codeAlpha3,numericCode,ISO_3166-2,riskLevel,riskScore
Turkey,TR,TUR,792,ISO 3166-2:TR,Low,25.00
India,IN,IND,356,ISO 3166-2:IN,Low,25.00
Taiwan,TW,TWN,158,ISO 3166-2:TW,Low,25.00`,
  }),
}
