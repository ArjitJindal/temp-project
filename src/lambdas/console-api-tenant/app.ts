import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { customAlphabet } from 'nanoid'
import { AccountsService } from '../../services/accounts'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

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
      auth0Domain,
    } = event.requestContext.authorizer
    const accountsService = new AccountsService({ auth0Domain })

    if (event.httpMethod === 'GET' && event.resource === '/tenants') {
      assertRole({ role, verifiedEmail }, 'root')
      const tenants: Tenant[] = (await accountsService.getTenants()).map(
        (tenant: Tenant): Tenant => ({
          id: tenant.id,
          name: tenant.name,
        })
      )
      return tenants
    } else if (
      event.resource === '/tenants' &&
      event.httpMethod === 'POST' &&
      event.body
    ) {
      assertRole({ role, verifiedEmail }, 'root')
      const randomizedId = customAlphabet(
        '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        10
      )()

      const bodyTenantId = (JSON.parse(event.body) as TenantCreationRequest)
        .tenantId

      const tenantService = new TenantService(bodyTenantId ?? randomizedId, {
        dynamoDb: getDynamoDbClientByEvent(event),
      })

      return tenantService.createTenant(JSON.parse(event.body))
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
