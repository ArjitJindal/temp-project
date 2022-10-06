import { TestApiEvent, TestApiRequestContext } from './types'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

const query: SanctionsSearchRequest = {
  searchTerm: 'Donald Trump',
}

export const event: TestApiEvent = {
  resource: '/sanctions/search',
  path: '/sanctions/search',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'flagright' },
  } as TestApiRequestContext,
  stageVariables: null,
  body: JSON.stringify(query),
}
