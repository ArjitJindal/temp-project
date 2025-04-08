import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getContext } from '../utils/context-storage'
import {
  assertPermissions,
  assertProductionAccess,
  JWTAuthorizerResult,
} from '@/@types/jwt'
import {
  getAlwaysAllowedAccess,
  getApiRequiredPermissions as getInternalApiRequiredPermissions,
} from '@/@types/openapi-internal-custom/DefaultApi'
import { determineApi } from '@/core/utils/api'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { SessionsService } from '@/services/sessions'

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
    const dynamoDb = getDynamoDbClientByEvent(event)

    const apiPath: string = event.resource
    const httpMethod: string = event.httpMethod

    const requiredPermissions = getInternalApiRequiredPermissions(
      apiPath,
      httpMethod
    )

    assertPermissions(requiredPermissions)
    // if api path ends with any of the exemptedApiPaths, then skip production access check
    if (!getAlwaysAllowedAccess(apiPath, httpMethod)) {
      assertProductionAccess()
    }

    const tenantId = event.requestContext.authorizer.tenantId

    const sessionsService = new SessionsService(tenantId, dynamoDb)
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions

    if (maxActiveSessions && !event.path.includes('/post-login')) {
      const userAgent =
        event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown'
      const deviceFingerprint = event.headers['x-fingerprint'] || 'unknown'

      await sessionsService.validateActiveSession(
        event.requestContext.authorizer.userId,
        { userAgent, deviceFingerprint }
      )
    }

    return await handler(event, ctx)
  }
