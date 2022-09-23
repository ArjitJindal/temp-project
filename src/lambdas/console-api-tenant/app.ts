import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { AccountsConfig } from '../console-api-account/app'
import { AccountsService } from '../console-api-account/services/accounts-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = ['features']

export const tenantsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const {
      role,
      principalId: tenantId,
      verifiedEmail,
    } = event.requestContext.authorizer
    const config = process.env as AccountsConfig
    const accountsService = new AccountsService(config)

    if (event.httpMethod === 'GET' && event.resource === '/tenants') {
      assertRole({ role, verifiedEmail }, 'root')
      const tenants: Tenant[] = (await accountsService.getTenants()).map(
        (tenant: Tenant): Tenant => ({
          id: tenant.id,
          name: tenant.name,
        })
      )
      return tenants
    } else if (event.resource === '/tenants/settings') {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      if (event.httpMethod === 'GET') {
        return tenantRepository.getTenantSettings()
      } else if (event.httpMethod === 'POST' && event.body) {
        const newTenantSettings = JSON.parse(event.body) as TenantSettings
        if (
          ROOT_ONLY_SETTINGS.find(
            (settingName) => newTenantSettings[settingName]
          )
        ) {
          assertRole({ role, verifiedEmail }, 'root')
        }
        assertRole({ role, verifiedEmail }, 'admin')

        return tenantRepository.createOrUpdateTenantSettings(newTenantSettings)
      }
    }
    throw new BadRequest('Unhandled request')
  }
)
