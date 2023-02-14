import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { RoleService } from '@/services/roles'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'

export type AccountsConfig = {
  AUTH0_DOMAIN: string
  AUTH0_CONSOLE_CLIENT_ID: string
}

export const rolesHandler = lambdaApi({ requiredFeatures: ['RBAC'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const config = process.env as AccountsConfig
    const rolesService = new RoleService(config)
    const { tenantId } = event.requestContext.authorizer

    if (event.httpMethod === 'GET' && event.resource === '/roles') {
      return await rolesService.getTenantRoles(tenantId)
    }
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/roles/{roleId}/permissions' &&
      event.pathParameters?.roleId
    ) {
      return await rolesService.getPermissions(event.pathParameters?.roleId)
    }
    throw new BadRequest('Unhandled request')
  }
)
