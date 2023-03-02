import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { RoleService } from '@/services/roles'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'

export const rolesHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { auth0Domain } = event.requestContext.authorizer
    const rolesService = new RoleService({ auth0Domain })
    const { tenantId } = event.requestContext.authorizer

    if (event.httpMethod === 'GET' && event.resource === '/roles') {
      return await rolesService.getTenantRoles(tenantId)
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/roles' &&
      event.body
    ) {
      return await rolesService.createRole(
        tenantId,
        JSON.parse(event.body) as AccountRole
      )
    }
    if (
      event.httpMethod === 'PATCH' &&
      event.resource === '/roles/{roleId}' &&
      event.body
    ) {
      const roleId = event.pathParameters?.roleId as string
      return await rolesService.updateRole(
        tenantId,
        roleId,
        JSON.parse(event.body) as AccountRole
      )
    }
    if (event.httpMethod === 'DELETE' && event.resource === '/roles/{roleId}') {
      const roleId = event.pathParameters?.roleId as string
      return await rolesService.deleteRole(tenantId, roleId)
    }
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/roles/{roleId}' &&
      event.pathParameters?.roleId
    ) {
      return await rolesService.getRole(event.pathParameters?.roleId)
    }
    throw new BadRequest('Unhandled request')
  }
)
