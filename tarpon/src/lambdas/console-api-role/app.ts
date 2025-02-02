import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RoleService } from '@/services/roles'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

export const rolesHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { auth0Domain } = event.requestContext.authorizer
    const rolesService = RoleService.getInstance(
      getDynamoDbClientByEvent(event),
      auth0Domain
    )
    const { tenantId } = event.requestContext.authorizer

    const handlers = new Handlers()

    handlers.registerGetRoles(
      async () => await rolesService.getTenantRoles(tenantId)
    )

    handlers.registerCreateRole(
      async (ctx, request) =>
        await rolesService.createRole(tenantId, request.CreateAccountRole)
    )

    handlers.registerUpdateRole(
      async (ctx, request) =>
        await rolesService.updateRole(
          tenantId,
          request.roleId,
          request.AccountRole
        )
    )

    handlers.registerDeleteRole(
      async (ctx, request) =>
        await rolesService.deleteRole(tenantId, request.roleId)
    )

    handlers.registerGetRole(
      async (ctx, request) => await rolesService.getRole(request.roleId)
    )

    return await handlers.handle(event)
  }
)
