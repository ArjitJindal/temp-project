import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'

export function getCredentialsFromEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >
): LambdaCredentials | undefined {
  if (process.env.ENV === 'local' || !event.requestContext.authorizer) {
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
