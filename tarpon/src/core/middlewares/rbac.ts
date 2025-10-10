import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import uniq from 'lodash/uniq'
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
import {
  getDynamicPermissionsType,
  PERMISSIONS_LIBRARY,
} from '@/services/rbac/utils/permissions'
import { FilterKey } from '@/@types/rbac/permissions'
import { enforceAndInjectFilters } from '@/services/rbac/utils/filter-evaluator'
import type { PermissionsNode } from '@/@types/rbac/permissions'

/**
 * Route-scoped filter injection (no hardcoding):
 *
 * For the current request, we derive which filter params to consider from
 * the route's required resources (FRNs) and the permissions library.
 *
 * Steps:
 * 1) getApiRequiredResources(apiPath, httpMethod) → FRNs the route requires.
 * 2) For each FRN, take the resource path (after ':::') and walk PERMISSIONS_LIBRARY by node id.
 * 3) Any ancestor node that has a `filter` contributes its `param` (e.g., 'filterCaseStatus').
 * 4) The union of such params forms an allowlist passed to enforceAndInjectFilters.
 *
 * Examples:
 * - /cases list → FRNs under case-management/... → finds case-status.filter.param → injects filterCaseStatus only.
 * - /alerts list → FRNs under case-management/alert-status/... → finds alert-status.filter.param;
 *   and still under case-management where case-status is an ancestor → collects both
 *   filterAlertStatus and filterCaseStatus.
 * - /transactions → unless its FRNs traverse a node with filter, no params are injected.
 */

// Derive filter params for this route by mapping required FRNs to filterable nodes in the library
function frnToPath(frn: string): string {
  // frn:console:tenantId:::path
  const idx = frn.indexOf(':::')
  return idx >= 0 ? frn.slice(idx + 3) : frn
}

function collectFilterParamsForPath(path: string): string[] {
  const params = new Set<string>()
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((p) => (p.includes(':') ? p.split(':')[0] : p)) // strip dynamic ids

  let currentLevel: PermissionsNode[] | undefined = PERMISSIONS_LIBRARY
  for (let i = 0; i < parts.length; i++) {
    if (!currentLevel || !currentLevel.length) {
      break
    }
    const part = parts[i]
    const node = currentLevel.find((n) => n.id === part)
    if (!node) {
      break
    }

    // If this node defines a filter param, collect it
    if ((node as any).filter?.param) {
      params.add((node as any).filter.param as string)
    }

    // Check if any children of this node have filters (for cases like case-management having case-status child with filter)
    if (node.children) {
      for (const child of node.children) {
        if ((child as any).filter?.param) {
          params.add((child as any).filter.param as string)
        }
      }
    }

    currentLevel = node.children
  }
  return Array.from(params)
}

function deriveFilterParamsForRoute(requiredResources: string[]): string[] {
  const all = new Set<string>()
  for (const frn of requiredResources) {
    const path = frnToPath(frn)
    collectFilterParamsForPath(path).forEach((p) => all.add(p))
  }
  return Array.from(all)
}

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

    // Derive allowlist of filter params for this route from the library + required FRNs
    const routeAllowParams = deriveFilterParamsForRoute(
      requiredResourcesWithValues
    )

    // Evaluate, validate, enforce and inject filters via evaluator (scoped)
    const { nextQueryParams } = enforceAndInjectFilters(
      event.queryStringParameters || {},
      (Array.isArray(statements) ? statements : []) as any[],
      routeAllowParams
    )
    event.queryStringParameters = nextQueryParams

    const dynamicPermissions = getDynamicPermissionsType(
      uniq(
        (Array.isArray(statements) ? statements : []).flatMap(
          (statement: any) => statement?.resources ?? []
        )
      )
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
            permission.ids.join(',')
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
