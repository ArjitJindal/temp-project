import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import createHttpError from 'http-errors'
import jwt from 'jsonwebtoken'
import { AccountsService } from '@/services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  assertCurrentUserRole,
  assertCurrentUserRoleAboveAdmin,
  JWTAuthorizerResult,
} from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getSecretByName } from '@/utils/secrets-manager'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { SessionsService } from '@/services/sessions'

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, auth0Domain, tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const sessionsService = new SessionsService(tenantId, dynamoDb)
    const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })
    const organization = await accountsService.getAccountTenant(userId)
    const handlers = new Handlers()

    handlers.registerGetPostLogin(async () => {
      const userAgent =
        event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown'
      const deviceFingerprint = event.headers['x-fingerprint'] || 'unknown'
      await sessionsService.refreshActiveSessions(userId, {
        userAgent,
        deviceFingerprint,
      })
    })

    handlers.registerMe(async () => await accountsService.getAccount(userId))

    handlers.registerGetAccounts(
      async () => await accountsService.getTenantAccounts(organization)
    )

    handlers.registerAccountsInvite(async (ctx, request) => {
      return await accountsService.inviteAccount(
        organization,
        request.AccountInvitePayload
      )
    })

    handlers.registerAccountsResendInvite(async (ctx, request) => {
      return await accountsService.sendPasswordResetEmail(
        request.ResendAccountInvitePayload.email
      )
    })

    handlers.registerAccountsChangeTenant(async (ctx, request) => {
      assertCurrentUserRoleAboveAdmin()
      await accountsService.accountsChangeTenantHandler(request, ctx.userId)
      return
    })

    handlers.registerAccountsDelete(async (ctx, request) => {
      const accountId = request.accountId
      const reassignTo = request.AccountDeletePayload.reassignTo

      if (accountId === userId) {
        throw new createHttpError.Forbidden(
          'You cannot delete your own account'
        )
      }

      if (accountId === reassignTo) {
        throw new createHttpError.Forbidden(
          'You cannot reassign an account to itself'
        )
      }

      await accountsService.deleteUser(organization, accountId, reassignTo)
    })

    handlers.registerAccountsEdit(async (ctx, request) => {
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
          ctx.tenantId,
          request.accountId,
          request.AccountSettings
        )
    )

    handlers.registerAccountsDeactivate(async (ctx, request) => {
      return await accountsService.deactivateUser(
        ctx.tenantId,
        request.accountId,
        request.InlineObject2.deactivate
      )
    })

    handlers.registerAccountsResetPassword(async (ctx, request) => {
      return await accountsService.resetPassword(request.accountId)
    })

    handlers.registerGetCluesoAuthToken(async () => {
      const cluesoSecret = await getSecretByName('clueso')
      const payload = {}
      const token = jwt.sign(payload, cluesoSecret.privateKey, {
        algorithm: 'HS256',
      })
      return {
        token,
      }
    })
    return await handlers.handle(event)
  }
)
