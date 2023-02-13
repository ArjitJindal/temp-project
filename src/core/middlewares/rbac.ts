import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { assertPermissions, JWTAuthorizerResult } from '@/@types/jwt'
import { getApiRequiredPermissions } from '@/@types/openapi-internal-custom/DefaultApi'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<
    AWS.STS.Credentials & JWTAuthorizerResult
  >
>

export const rbacMiddleware =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    // Find matching operation and its required permissions.
    // Currently supporting only the internal API. To support other APIs,
    // we need a way for lambdas to be aware of which API they belong to so that
    // we can resolve conflicts between APIs with matching paths + methods.
    const requiredPermissions = getApiRequiredPermissions(
      event.resource,
      event.httpMethod
    )

    assertPermissions(requiredPermissions)
    return await handler(event, ctx)
  }
