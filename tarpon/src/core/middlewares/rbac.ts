import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { uniq } from 'lodash'
import { getContext } from '../utils/context-storage'
import { userStatements } from '../utils/context'
import {
  assertProductionAccess,
  assertResourceAccess,
  JWTAuthorizerResult,
} from '@/@types/jwt'
import {
  getAlwaysAllowedAccess,
  getApiRequiredResources,
} from '@/@types/openapi-internal-custom/DefaultApi'
import { determineApi } from '@/core/utils/api'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { SessionsService } from '@/services/sessions'
import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'
import { getDynamicPermissionsType } from '@/services/rbac/utils/permissions'
import { FilterKey } from '@/@types/rbac/permissions'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

const subTypeFilterMap: Record<DynamicPermissionsNodeSubType, FilterKey> = {
  NARRATIVE_TEMPLATES: 'filterNarrativeTemplateIds',
}

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

    const statements = await userStatements(
      event.requestContext.authorizer.tenantId
    )

    const requiredResources = getApiRequiredResources(apiPath, httpMethod)
    // replace path parameters with actual values
    const pathParameters = event.pathParameters
    const requiredResourcesWithValues = requiredResources.map((resource) => {
      for (const [key, value] of Object.entries(pathParameters ?? {})) {
        resource = resource.replace(new RegExp(`{${key}}`, 'g'), value ?? '')
      }
      return resource
    })

    assertResourceAccess(requiredResourcesWithValues, statements)

    const dynamicPermissions = getDynamicPermissionsType(
      uniq(statements.flatMap((statement) => statement.resources))
    ) // Even if its write we consider it as read and read is considered as read

    for (const permission of dynamicPermissions) {
      const filterKey = subTypeFilterMap[permission.subType]

      if (filterKey) {
        const currentFilterValue =
          event.queryStringParameters?.[filterKey] ?? ''
        event.queryStringParameters = {
          ...event.queryStringParameters,
          [filterKey]: currentFilterValue.concat(
            permission.ids.length && currentFilterValue.length ? ',' : '',
            ...permission.ids
          ),
        }
      }
    }

    // if api path ends with any of the exemptedApiPaths, then skip production access check
    if (!getAlwaysAllowedAccess(apiPath, httpMethod)) {
      assertProductionAccess()
    }

    const tenantId = event.requestContext.authorizer.tenantId

    const sessionsService = new SessionsService(tenantId, dynamoDb)
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions

    if (
      maxActiveSessions &&
      !event.path.includes('/post-login') &&
      !event.path.endsWith('/statements')
    ) {
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
