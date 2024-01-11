import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context,
  Handler,
} from 'aws-lambda'
export const MOCKED_USER = {
  role: 'testing',
  userId: 'mocked-user-id',
  verifiedEmail: 'mocked-user-email',
}
export const MOCKED_TENANT_ID = 'mocked-tenant-id'

export async function permissionTest(
  handler: Handler,
  context: Partial<Context>,
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >,
  accessDenied: boolean
) {
  const response = await handler(event, context as any, null as any)
  if (!response) {
    throw new Error('Response is empty')
  }
  accessDenied
    ? expect(response?.statusCode).toBe(403)
    : expect(response?.statusCode).not.toBe(403)
}
