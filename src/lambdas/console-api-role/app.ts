import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { RoleService } from '@/services/roles'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'

export const rolesHandler = lambdaApi({ requiredFeatures: ['RBAC'] })(
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
      event.httpMethod === 'GET' &&
      event.resource === '/roles/{roleId}/permissions' &&
      event.pathParameters?.roleId
    ) {
      return await rolesService.getPermissions(event.pathParameters?.roleId)
    }
    throw new BadRequest('Unhandled request')
  }
)
