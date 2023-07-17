import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, Forbidden } from 'http-errors'
import { AccountsService } from '../../services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertCurrentUserRole, JWTAuthorizerResult } from '@/@types/jwt'
import { Account } from '@/@types/openapi-internal/Account'
import { ChangeTenantPayload } from '@/@types/openapi-internal/ChangeTenantPayload'
import { AccountInvitePayload } from '@/@types/openapi-internal/AccountInvitePayload'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

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

    if (event.httpMethod === 'GET' && event.resource === '/me') {
      return await accountsService.getAccount(userId)
    }

    if (event.httpMethod === 'GET' && event.resource === '/accounts') {
      // todo: this call can only return up to 1000 users, need to handle this
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      return accounts
    } else if (event.httpMethod === 'POST' && event.resource === '/accounts') {
      assertCurrentUserRole('admin')
      if (event.body == null) {
        throw new BadRequest(`Body should not be empty`)
      }
      const body: AccountInvitePayload = JSON.parse(event.body)
      return await accountsService.inviteAccount(organization, body)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/accounts/{accountId}/change_tenant'
    ) {
      assertCurrentUserRole('root')
      const { pathParameters } = event
      if (event.body == null) {
        throw new BadRequest(`Body should not be empty`)
      }
      const { newTenantId } = JSON.parse(event.body) as ChangeTenantPayload
      if (!pathParameters?.accountId) {
        throw new BadRequest(`accountId is not provided`)
      }
      if (newTenantId == null) {
        throw new BadRequest(`newTenantId is not provided`)
      }
      await accountsService.changeUserTenant(
        pathParameters?.accountId,
        newTenantId,
        userId
      )
      return true
    } else if (event.resource === '/accounts/{accountId}') {
      const { pathParameters } = event
      const accountId = pathParameters?.accountId
      if (event.httpMethod === 'DELETE') {
        assertCurrentUserRole('admin')
        if (!accountId) {
          throw new BadRequest(`accountId is not provided`)
        }
        await accountsService.deleteUser(organization, accountId)
        return true
      } else if (event.httpMethod === 'POST') {
        assertCurrentUserRole('admin')
        if (event.body == null) {
          throw new BadRequest(`Body should not be empty`)
        }
        const patchPayload = JSON.parse(event.body) as AccountPatchPayload
        if (patchPayload.role === 'root') {
          throw new Forbidden(`It's not possible to set a root role`)
        }

        if (!accountId) {
          throw new BadRequest(`accountId is not provided`)
        }

        return await accountsService.patchUser(
          organization,
          accountId,
          patchPayload
        )
      }
    } else if (event.resource === '/accounts/{accountId}/settings') {
      const { pathParameters } = event
      const accountId = pathParameters?.accountId
      if (!accountId) {
        throw new BadRequest(`accountId is not provided`)
      }
      if (accountId != userId) {
        assertCurrentUserRole('root')
      }
      if (event.httpMethod === 'GET') {
        return await accountsService.getUserSettings(accountId)
      } else if (event.httpMethod === 'PATCH') {
        if (event.body == null) {
          throw new BadRequest(`Body should not be empty`)
        }
        const payload = JSON.parse(event.body) as AccountSettings
        return await accountsService.patchUserSettings(accountId, payload)
      }
    }

    throw new BadRequest('Unhandled request')
  }
)
