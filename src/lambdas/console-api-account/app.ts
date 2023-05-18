import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, Forbidden } from 'http-errors'
import { AccountsService } from '../../services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'
import { Account } from '@/@types/openapi-internal/Account'
import { ChangeTenantPayload } from '@/@types/openapi-internal/ChangeTenantPayload'
import { AccountInvitePayload } from '@/@types/openapi-internal/AccountInvitePayload'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import { RoleService } from '@/services/roles'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, verifiedEmail, role, tenantId, auth0Domain } =
      event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
    const rolesService = new RoleService({ auth0Domain })
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
      assertRole({ role, verifiedEmail }, 'admin')
      if (event.body == null) {
        throw new BadRequest(`Body should not be empty`)
      }
      const body: AccountInvitePayload = JSON.parse(event.body)
      const inviteRole = body.role ?? 'analyst'
      if (inviteRole === 'root') {
        throw new Forbidden(`It's not possible to create a root user`)
      }
      const dynamoDb = await getDynamoDbClientByEvent(event)
      const allAccounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )

      const existingAccount = allAccounts.filter(
        (account) => account.role !== 'root' && account.blocked === false
      )

      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })

      const tenantSettings = await tenantRepository.getTenantSettings()

      if (
        tenantSettings?.limits?.seats &&
        existingAccount.length >= tenantSettings?.limits?.seats
      ) {
        throw new Forbidden(`You have reached the maximum number of users`)
      }

      const user = await accountsService.createAccountInOrganization(
        organization,
        {
          email: body.email,
          role: inviteRole,
          isEscalationContact: body.isEscalationContact,
        }
      )
      await rolesService.setRole(tenantId, user.id, inviteRole)
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/accounts/{accountId}/change_tenant'
    ) {
      assertRole({ role, verifiedEmail }, 'root')
      const { pathParameters } = event
      const idToChange = pathParameters?.accountId
      if (!idToChange) {
        throw new BadRequest(`accountId is not provided`)
      }
      if (event.body == null) {
        throw new BadRequest(`Body should not be empty`)
      }
      const { newTenantId } = JSON.parse(event.body) as ChangeTenantPayload
      const oldTenant = await accountsService.getAccountTenant(idToChange)
      const newTenant = await accountsService.getTenantById(newTenantId)
      if (newTenant == null) {
        throw new BadRequest(`Unable to find tenant by id: ${newTenantId}`)
      }
      await accountsService.changeUserTenant(oldTenant, newTenant, userId)
      return true
    } else if (event.resource === '/accounts/{accountId}') {
      const { pathParameters } = event
      const accountId = pathParameters?.accountId
      if (!accountId) {
        throw new BadRequest(`accountId is not provided`)
      }
      if (event.httpMethod === 'DELETE') {
        assertRole({ role, verifiedEmail }, 'admin')

        await accountsService.deleteUser(organization, accountId)
        return true
      } else if (event.httpMethod === 'POST') {
        assertRole({ role, verifiedEmail }, 'admin')
        if (event.body == null) {
          throw new BadRequest(`Body should not be empty`)
        }
        const patchPayload = JSON.parse(event.body) as AccountPatchPayload
        if (patchPayload.role === 'root') {
          throw new Forbidden(`It's not possible to set a root role`)
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
        assertRole({ role, verifiedEmail }, 'root')
      }
      if (event.httpMethod === 'GET') {
        return await accountsService.getUserSettings(organization, accountId)
      } else if (event.httpMethod === 'PATCH') {
        if (event.body == null) {
          throw new BadRequest(`Body should not be empty`)
        }
        const payload = JSON.parse(event.body) as AccountSettings
        return await accountsService.patchUserSettings(
          organization,
          accountId,
          payload
        )
      }
    }

    throw new BadRequest('Unhandled request')
  }
)
