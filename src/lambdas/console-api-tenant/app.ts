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
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getFullTenantId } from '@/lambdas/jwt-authorizer/app'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { sendBatchJobCommand } from '@/services/batch-job'
import { envIsNot } from '@/utils/env'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = ['features', 'limits']

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
    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService({ auth0Domain }, { mongoDb })

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
      const newTenantId = customAlphabet(
        '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        10
      )()

      const request = JSON.parse(event.body) as TenantCreationRequest
      const requestTenantId = request.tenantId
      const tenantId = requestTenantId || newTenantId

      const tenantService = new TenantService(tenantId, {
        mongoDb,
        dynamoDb: getDynamoDbClientByEvent(event),
      })

      const response = tenantService.createTenant(JSON.parse(event.body))

      // Create demo mode environment in non-prod environments.
      if (envIsNot('prod')) {
        const fullTenantId = getFullTenantId(
          tenantId,
          request.features.indexOf('DEMO_MODE') > -1
        )
        const batchJob: DemoModeDataLoadBatchJob = {
          type: 'DEMO_MODE_DATA_LOAD',
          tenantId: fullTenantId,
          awsCredentials: getCredentialsFromEvent(event),
        }
        await sendBatchJobCommand(fullTenantId, batchJob)
      }
      return response
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
