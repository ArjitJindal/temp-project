import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { customAlphabet } from 'nanoid'
import { AccountsService } from '../../services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult, assertCurrentUserRole } from '@/@types/jwt'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getFullTenantId } from '@/lambdas/jwt-authorizer/app'
import {
  DemoModeDataLoadBatchJob,
  PulseDataLoadBatchJob,
} from '@/@types/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { sendBatchJobCommand } from '@/services/batch-job'
import { publishAuditLog } from '@/services/audit-log'
import { envIs, envIsNot } from '@/utils/env'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = ['features', 'limits']

export const tenantsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, auth0Domain } =
      event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService({ auth0Domain }, { mongoDb })

    const handlers = new Handlers()

    handlers.registerGetTenantsList(async () => {
      assertCurrentUserRole('root')
      const tenants: Tenant[] = (await accountsService.getTenants()).map(
        (tenant: Tenant): Tenant => ({
          id: tenant.id,
          name: tenant.name,
        })
      )
      return tenants
    })

    handlers.registerPostCreateTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      const newTenantId = customAlphabet(
        '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        10
      )()
      const dynamoDb = getDynamoDbClient()
      const tenantService = new TenantService(
        request.TenantCreationRequest.tenantId ?? newTenantId,
        { mongoDb, dynamoDb }
      )
      const response = await tenantService.createTenant(
        request.TenantCreationRequest
      )
      if (envIsNot('prod')) {
        const fullTenantId = getFullTenantId(tenantId, true)
        const batchJob: DemoModeDataLoadBatchJob = {
          type: 'DEMO_MODE_DATA_LOAD',
          tenantId: fullTenantId,
          awsCredentials: getCredentialsFromEvent(event),
        }
        await sendBatchJobCommand(fullTenantId, batchJob)
      }
      return response
    })

    handlers.registerGetTenantsSettings(
      async (ctx) =>
        await new TenantRepository(ctx.tenantId, {
          dynamoDb: getDynamoDbClientByEvent(event),
        }).getTenantSettings()
    )

    handlers.registerPostTenantsSettings(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantRepository = new TenantRepository(ctx.tenantId, { dynamoDb })
      const newTenantSettings = request.TenantSettings
      if (
        ROOT_ONLY_SETTINGS.find((settingName) => newTenantSettings[settingName])
      ) {
        assertCurrentUserRole('root')
      }
      assertCurrentUserRole('admin')
      const tenantSettingsCurrent = await tenantRepository.getTenantSettings()
      const updatedResult = await tenantRepository.createOrUpdateTenantSettings(
        newTenantSettings
      )
      if (
        !tenantSettingsCurrent.features?.includes('PULSE') &&
        newTenantSettings.features?.includes('PULSE')
      ) {
        const batchJob: PulseDataLoadBatchJob = {
          type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
          tenantId: tenantId,
          awsCredentials: getCredentialsFromEvent(event),
        }
        await sendBatchJobCommand(tenantId, batchJob)
      }
      const auditLog: AuditLog = {
        type: 'ACCOUNT',
        action: 'UPDATE',
        timestamp: Date.now(),
        oldImage: tenantSettingsCurrent,
        newImage: newTenantSettings,
      }
      await publishAuditLog(tenantId, auditLog)

      return updatedResult
    })

    handlers.registerGetSeedDemoData(async (ctx) => {
      if (envIsNot('prod')) {
        let fullTenantId = ctx.tenantId
        if (envIs('sandbox')) {
          fullTenantId = getFullTenantId(ctx.tenantId, true)
        }
        const batchJob: DemoModeDataLoadBatchJob = {
          type: 'DEMO_MODE_DATA_LOAD',
          tenantId: fullTenantId,
          awsCredentials: getCredentialsFromEvent(event),
        }
        await sendBatchJobCommand(fullTenantId, batchJob)
      }
      return
    })

    handlers.registerGetTenantUsageData(
      async (ctx) =>
        await new TenantService(ctx.tenantId, {
          dynamoDb: getDynamoDbClientByEvent(event),
          mongoDb,
        }).getUsagePlanData(ctx.tenantId)
    )

    handlers.registerGetTenantApiKeys(async (ctx, request) => {
      return await new TenantService(ctx.tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
        mongoDb,
      }).getApiKeys(
        request.unmaskApiKeyId && request.unmask != null
          ? {
              apiKeyId: request.unmaskApiKeyId,
              unmask: request.unmask,
            }
          : undefined
      )
    })

    return await handlers.handle(event)
  }
)
