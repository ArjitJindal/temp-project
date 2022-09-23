import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { AccountsService } from './services/accounts-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'
import { Account } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { ChangeTenantPayload } from '@/@types/openapi-internal/ChangeTenantPayload'

export type AccountsConfig = {
  AUTH0_DOMAIN: string
  AUTH0_MANAGEMENT_CLIENT_ID: string
  AUTH0_MANAGEMENT_CLIENT_SECRET: string
  AUTH0_CONSOLE_CLIENT_ID: string
}

export const accountsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { userId, verifiedEmail, role } = event.requestContext.authorizer
    const config = process.env as AccountsConfig

    const accountsService = new AccountsService(config)

    if (event.httpMethod === 'GET' && event.resource === '/accounts') {
      const tenant = await accountsService.getAccountTenant(userId)

      // todo: this call can only return up to 1000 users, need to handle this
      const accounts: Account[] = await accountsService.getTenantAccounts(
        tenant
      )
      return accounts
    } else if (event.httpMethod === 'POST' && event.resource === '/accounts') {
      assertRole({ role, verifiedEmail }, 'admin')
      if (event.body == null) {
        throw new Error(`Body should not be empty`)
      }
      // todo: validate
      const { email } = JSON.parse(event.body)

      const organization = await accountsService.getAccountTenant(userId)
      const user = await accountsService.createAccountInOrganization(
        organization,
        {
          email,
          role: 'user',
        }
      )

      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/accounts/{userId}/change_tenant'
    ) {
      assertRole({ role, verifiedEmail }, 'root')
      const { pathParameters } = event
      const idToChange = pathParameters?.userId
      if (!idToChange) {
        throw new Error(`userId is not provided`)
      }
      if (event.body == null) {
        throw new Error(`Body should not be empty`)
      }
      const { newTenantId } = JSON.parse(event.body) as ChangeTenantPayload
      const oldTenant = await accountsService.getAccountTenant(idToChange)
      logger.info('oldTenant', JSON.stringify(oldTenant))
      const newTenant = await accountsService.getTenantById(newTenantId)
      if (newTenant == null) {
        throw new BadRequest(`Unable to find tenant by id: ${newTenantId}`)
      }
      logger.info('newTenant', JSON.stringify(newTenant))
      await accountsService.changeUserTenant(oldTenant, newTenant, userId)
      return true
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/accounts/{userId}'
    ) {
      const { pathParameters } = event
      assertRole({ role, verifiedEmail }, 'admin')

      const idToDelete = pathParameters?.userId
      if (!idToDelete) {
        throw new Error(`userId is not provided`)
      }

      const organization = await accountsService.getAccountTenant(userId)
      await accountsService.deleteUser(organization, idToDelete)
      return true
    }

    throw new BadRequest('Unhandled request')
  }
)
