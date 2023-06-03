import { TestApiEvent, TestApiRequestContext } from './types'
import { AccountInvitePayload } from '@/@types/openapi-internal/AccountInvitePayload'

export const event: TestApiEvent = {
  resource: '/accounts',
  path: '/accounts',
  httpMethod: 'POST',
  requestContext: {
    authorizer: {
      principalId: 'flagright',
      userId: 'auth0|6214112c1f466500695754f9',
      role: 'root',
      verifiedEmail: 'test@flagright.com',
    },
  } as TestApiRequestContext,
  body: JSON.stringify({
    email: '<enter your persoanl email here>',
  } as AccountInvitePayload),
}
