import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { AccountsService } from '../../services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertCurrentUserRole, JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, auth0Domain } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
    const organization = await accountsService.getAccountTenant(userId)
    const handlers = new Handlers()

    handlers.registerMe(async () => await accountsService.getAccount(userId))

    handlers.registerGetAccounts(
      async () => await accountsService.getTenantAccounts(organization)
    )

    handlers.registerAccountsInvite(async (ctx, request) => {
      assertCurrentUserRole('admin')
      return await accountsService.inviteAccount(
        organization,
        request.AccountInvitePayload
      )
    })

    handlers.registerAccountsChangeTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      await accountsService.accountsChangeTenantHandler(request, ctx.userId)
      return
    })

    handlers.registerAccountsDelete(async (ctx, request) => {
      const accountId = request.accountId
      assertCurrentUserRole('admin')
      return await accountsService.deleteUser(organization, accountId)
    })

    handlers.registerAccountsEdit(async (ctx, request) => {
      assertCurrentUserRole('admin')
      return await accountsService.patchUserHandler(request, organization)
    })

    handlers.registerAccountGetSettings(async (ctx, request) => {
      const accountId = request.accountId
      if (accountId != userId) {
        assertCurrentUserRole('root')
      }
      return await accountsService.getUserSettings(accountId)
    })

    handlers.registerAccountChangeSettings(
      async (ctx, request) =>
        await accountsService.patchUserSettings(
          request.accountId,
          request.AccountSettings
        )
    )

    return await handlers.handle(event)
  }
)
