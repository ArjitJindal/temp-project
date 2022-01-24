import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'

export function getCredentialsFromEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): CredentialsOptions | undefined {
  if (
    !process.env.NODE_ENV ||
    process.env.NODE_ENV === 'dev' ||
    !event.requestContext.authorizer
  ) {
    return undefined
  }
  const { AccessKeyId, SecretAccessKey, SessionToken } =
    event.requestContext.authorizer
  return {
    accessKeyId: AccessKeyId,
    secretAccessKey: SecretAccessKey,
    sessionToken: SessionToken,
  }
}
