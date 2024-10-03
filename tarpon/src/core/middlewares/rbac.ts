import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getContext } from '../utils/context'
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
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService } from '@/services/accounts'

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

    const maxActiveSessions = getContext()?.settings?.maxActiveSessions
    if (
      maxActiveSessions &&
      maxActiveSessions > 0 &&
      !event.path.includes('/post-login')
    ) {
      const accountsService = new AccountsService(
        { auth0Domain: event.requestContext.authorizer.auth0Domain },
        { mongoDb: await getMongoDbClient(), dynamoDb: getDynamoDbClient() }
      )
      await accountsService.validateActiveSession(
        event.requestContext.authorizer.tenantId,
        event.requestContext.authorizer.userId,
        {
          userIp: event.headers['X-Forwarded-For']
            ? event.headers['X-Forwarded-For'].split(',')[0]
            : event.requestContext.identity.sourceIp,
          userAgent:
            event.headers['User-Agent'] ||
            event.headers['user-agent'] ||
            'unknown',
          deviceFingerprint: event.headers['x-fingerprint'] || 'unknown',
        }
      )
    }

    return await handler(event, ctx)
  }
