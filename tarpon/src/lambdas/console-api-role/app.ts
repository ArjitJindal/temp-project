import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RoleService } from '@/services/roles'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { PermissionsService } from '@/services/rbac'
import { DynamoRolesRepository } from '@/services/roles/repository/dynamo'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const rolesHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { auth0Domain } = event.requestContext.authorizer
    const dynamoDbClient = getDynamoDbClientByEvent(event)
    const rolesService = RoleService.getInstance(dynamoDbClient, auth0Domain)
    const dynamoRolesRepository = new DynamoRolesRepository(
      auth0Domain,
      dynamoDbClient
    )
    const mongoClient = await getMongoDbClient()
    const { tenantId } = event.requestContext.authorizer

    const handlers = new Handlers()

    handlers.registerGetRoles(
      async () => await rolesService.getTenantRoles(tenantId)
    )

    handlers.registerCreateRole(async (ctx, request) => {
      const response = await rolesService.createRole(
        tenantId,
        request.CreateAccountRole
      )
      return response.result
    })

    handlers.registerUpdateRole(async (ctx, request) => {
      await rolesService.updateRole(
        tenantId,
        request.roleId,
        request.AccountRole
      )
    })

    handlers.registerDeleteRole(async (ctx, request) => {
      const response = await rolesService.deleteRole(tenantId, request.roleId)
      return response.result
    })

    handlers.registerGetRole(
      async (ctx, request) => await rolesService.getRole(request.roleId)
    )

    handlers.registerGetAllPermissions(async (ctx, request) => {
      const rbacService = new PermissionsService(ctx.tenantId, mongoClient)
      return rbacService.getAllPermissions(request.search)
    })

    handlers.registerGetRolesByNameStatements(async (ctx) => {
      return await dynamoRolesRepository.getRoleStatements(
        ctx.tenantId,
        ctx.role
      )
    })

    return await handlers.handle(event)
  }
)
