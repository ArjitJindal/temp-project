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
import { AccountRoleName } from '@/@types/openapi-internal/AccountRoleName'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import { isValidAccountRoleName } from '@/@types/openapi-internal-custom/AccountRoleName'
import { ChangeRolePayload } from '@/@types/openapi-internal/ChangeRolePayload'
import { RoleService } from '@/services/roles'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'

export type AccountsConfig = {
  AUTH0_DOMAIN: string
  AUTH0_CONSOLE_CLIENT_ID: string
}

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, verifiedEmail, role, tenantId } =
      event.requestContext.authorizer
    const config = process.env as AccountsConfig

    const accountsService = new AccountsService(config)
    const rolesService = new RoleService(config)
    const organization = await accountsService.getAccountTenant(userId)

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
      const inviteRole: AccountRoleName = body.role ?? 'user'
      if (!isValidAccountRoleName(inviteRole)) {
        throw new BadRequest(`User role is not valid`)
      }
      if (inviteRole === 'root') {
        throw new Forbidden(`It's not possible to create a root user`)
      }

      const user = await accountsService.createAccountInOrganization(
        organization,
        {
          email: body.email,
          role: inviteRole,
        }
      )
      await rolesService.setRole(tenantId, user.id, inviteRole)
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/accounts/{accountId}/change_role'
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
      const { role: newRole } = JSON.parse(event.body) as ChangeRolePayload
      await rolesService.setRole(tenantId, idToChange, newRole as string)
      return true
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
      } else if (event.httpMethod === 'PATCH') {
        assertRole({ role, verifiedEmail }, 'admin')
        if (event.body == null) {
          throw new BadRequest(`Body should not be empty`)
        }
        const patchPayload = JSON.parse(event.body) as AccountPatchPayload
        if (!isValidAccountRoleName(patchPayload.role)) {
          throw new BadRequest(`User role is not valid`)
        }
        if (patchPayload.role === 'root') {
          throw new Forbidden(`It's not possible to create a root user`)
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
