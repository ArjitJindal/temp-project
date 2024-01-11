import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { assertPermissions, JWTAuthorizerResult } from '@/@types/jwt'
import { getApiRequiredPermissions as getInternalApiRequiredPermissions } from '@/@types/openapi-internal-custom/DefaultApi'
import { determineApi } from '@/core/utils/api'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const rbacMiddleware =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    const api = determineApi(ctx)
    if (api !== 'CONSOLE' && ctx?.functionName !== 'Testing-API') {
      return await handler(event, ctx)
    }
    const requiredPermissions = getInternalApiRequiredPermissions(
      event.resource,
      event.httpMethod
    )
    assertPermissions(requiredPermissions)
    return await handler(event, ctx)
  }
