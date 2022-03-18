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
  if (process.env.ENV === 'local') {
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
