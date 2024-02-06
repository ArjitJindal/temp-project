import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { shortId } from '@flagright/lib/utils'
import createHttpError from 'http-errors'
import { AccountsService } from '../../services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  JWTAuthorizerResult,
  assertCurrentUserRole,
  assertCurrentUserRoleAboveAdmin,
  assertHasDangerousTenantDelete,
} from '@/@types/jwt'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { publishAuditLog } from '@/services/audit-log'
import { envIs, envIsNot } from '@/utils/env'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { NarrativeService } from '@/services/tenants/narrative-template-service'
import {
  ChecklistTemplateWithId,
  ChecklistTemplatesService,
} from '@/services/tenants/checklist-template-service'
import {
  RuleQueueWithId,
  RuleQueuesService,
} from '@/services/tenants/rule-queue-service'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getFullTenantId } from '@/utils/tenant'
import { tenantSettings } from '@/core/utils/context'

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
      assertCurrentUserRoleAboveAdmin()
      const tenants = await accountsService.getTenants()
      const data = tenants.map(
        (tenant): Tenant => ({
          id: tenant.id,
          name: tenant.name,
          isProductionAccessDisabled:
            tenant.isProductionAccessDisabled ?? false,
          region: tenant.region,
        })
      )
      return data
    })

    handlers.registerPostCreateTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      const newTenantId = shortId(10)
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
        await sendBatchJobCommand({
          type: 'DEMO_MODE_DATA_LOAD',
          tenantId: fullTenantId,
          awsCredentials: getCredentialsFromEvent(event),
        })
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
      const newTenantSettings = request.TenantSettings
      if (
        ROOT_ONLY_SETTINGS.find((settingName) => newTenantSettings[settingName])
      ) {
        assertCurrentUserRole('root')
      }
      assertCurrentUserRole('admin')
      const tenantSettingsCurrent = await tenantSettings(ctx.tenantId)
      const tenantService = new TenantService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      const updatedResult = await tenantService.createOrUpdateTenantSettings(
        newTenantSettings
      )
      if (
        !tenantSettingsCurrent.features?.includes('RISK_SCORING') &&
        newTenantSettings.features?.includes('RISK_SCORING')
      ) {
        await sendBatchJobCommand({
          type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
          tenantId: tenantId,
          awsCredentials: getCredentialsFromEvent(event),
        })
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

    handlers.registerGetTenantUsageData(
      async (ctx) =>
        await new TenantService(ctx.tenantId, {
          dynamoDb: getDynamoDbClientByEvent(event),
          mongoDb,
        }).getUsagePlanData(ctx.tenantId)
    )

    handlers.registerGetTenantApiKeys(async (ctx, request) => {
      const auditLog: AuditLog = {
        type: 'API-KEY',
        action: 'VIEW',
        timestamp: Date.now(),
      }
      const apiKeys = await new TenantService(ctx.tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
        mongoDb,
      }).getApiKeys(
        request.unmaskApiKeyId && request.unmask != null
          ? { apiKeyId: request.unmaskApiKeyId, unmask: request.unmask }
          : undefined
      )
      if (request.unmaskApiKeyId && request.unmask != null) {
        await publishAuditLog(tenantId, auditLog)
      }
      return apiKeys
    })

    /** Narratives */
    const narrativeService = new NarrativeService(tenantId, mongoDb)
    handlers.registerGetNarratives(
      async (ctx, request) =>
        await narrativeService.getNarrativeTemplates({
          page: request.page,
          pageSize: request.pageSize,
        })
    )
    handlers.registerGetNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.getNarrativeTemplate(request.narrativeTemplateId)
    )
    handlers.registerPutNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.updateNarrativeTemplate(
          request.narrativeTemplateId,
          request.NarrativeTemplateRequest
        )
    )
    handlers.registerDeleteNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.deleteNarrativeTemplate(
          request.narrativeTemplateId
        )
    )
    handlers.registerPostNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.createNarrativeTemplate(
          request.NarrativeTemplateRequest
        )
    )
    handlers.registerPostTenantsTriggerBatchJob(async (ctx, request) => {
      assertCurrentUserRole('root')
      const tenantId = ctx.tenantId
      const batchJobType = request.TenantTriggerBatchJobRequest.jobName
      switch (batchJobType) {
        case 'ONGOING_MERCHANT_MONITORING': {
          await sendBatchJobCommand({
            type: 'ONGOING_MERCHANT_MONITORING',
            tenantId: tenantId,
          })
          break
        }
        case 'PULSE_USERS_BACKFILL_RISK_SCORE': {
          await sendBatchJobCommand({
            type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
            tenantId: tenantId,
            awsCredentials: getCredentialsFromEvent(event),
          })
          break
        }
        case 'DEMO_MODE_DATA_LOAD': {
          if (envIsNot('prod')) {
            let fullTenantId = ctx.tenantId
            if (envIs('sandbox')) {
              fullTenantId = getFullTenantId(ctx.tenantId, true)
            }
            await sendBatchJobCommand({
              type: 'DEMO_MODE_DATA_LOAD',
              tenantId: fullTenantId,
              awsCredentials: getCredentialsFromEvent(event),
            })
          }
          break
        }

        case 'TEST_FARGATE': {
          await sendBatchJobCommand({
            type: 'TEST_FARGATE',
            tenantId: tenantId,
            parameters: {
              message: 'Hello from Flagright Console API',
            },
          })
          break
        }

        default: {
          throw new Error(`Unknown batch job type: ${batchJobType}`)
        }
      }
      return
    })

    /** Checklist templates */
    const checklistService = new ChecklistTemplatesService(tenantId, mongoDb)
    handlers.registerGetChecklistTemplate(async (ctx, request) => {
      return checklistService.getChecklistTemplate(request.checklistTemplateId)
    })
    handlers.registerGetChecklistTemplates(async (ctx, request) => {
      return checklistService.getChecklistTemplates(request)
    })
    handlers.registerPostChecklistTemplates(async (ctx, request) => {
      return checklistService.createChecklistTemplate(request.ChecklistTemplate)
    })
    handlers.registerPutChecklistTemplates(async (ctx, request) => {
      return checklistService.updateChecklistTemplate({
        ...request.ChecklistTemplate,
        id: request.checklistTemplateId,
      } as ChecklistTemplateWithId)
    })
    handlers.registerDeleteChecklistTemplate(async (ctx, request) => {
      await checklistService.deleteChecklistTemplate(
        request.checklistTemplateId
      )
    })

    /** Rule Queue */
    const ruleQueueService = new RuleQueuesService(tenantId, mongoDb)
    handlers.registerGetRuleQueue(async (ctx, request) => {
      return ruleQueueService.getRuleQueue(request.ruleQueueId)
    })
    handlers.registerGetRuleQueues(async (ctx, request) => {
      return ruleQueueService.getRuleQueues(request)
    })
    handlers.registerPostRuleQueue(async (ctx, request) => {
      return ruleQueueService.createRuleQueue(request.RuleQueue)
    })
    handlers.registerPutRuleQueue(async (ctx, request) => {
      return ruleQueueService.updateRuleQueue({
        ...request.RuleQueue,
        id: request.ruleQueueId,
      } as RuleQueueWithId)
    })

    handlers.registerDeleteTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      assertHasDangerousTenantDelete()

      if (envIsNot('dev')) {
        throw new createHttpError.Forbidden(
          'Cannot delete tenant in non-dev environment'
        )
      }

      const { tenantId, notRecoverable } = request.DeleteTenant

      if (!tenantId) {
        throw new createHttpError.BadRequest(
          'Cannot delete tenant: no tenantIdToDelete'
        )
      }

      const tenantRepository = new TenantRepository(tenantId, { mongoDb })

      if (await tenantRepository.isDeletetionRecordExists(tenantId)) {
        throw new createHttpError.Forbidden(
          `Tenant deletion record already exists for tenantId: ${tenantId}`
        )
      }

      await tenantRepository.createPendingRecordForTenantDeletion({
        tenantId,
        triggeredByEmail: ctx.email,
        triggeredById: ctx.userId,
        notRecoverable: notRecoverable ?? false,
      })

      await sendBatchJobCommand({
        type: 'TENANT_DELETION',
        tenantId,
        notRecoverable: request.DeleteTenant.notRecoverable ?? false,
      })

      return
    })

    handlers.registerDeleteRuleQueue(async (ctx, request) => {
      const dynamoDb = getDynamoDbClient()
      const alertsRepository = new AlertsRepository(tenantId, {
        mongoDb,
      })
      const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
        dynamoDb,
      })
      await ruleQueueService.deleteRuleQueue(request.ruleQueueId)
      await ruleInstanceRepository.deleteRuleQueue(request.ruleQueueId)
      await alertsRepository.deleteRuleQueue(request.ruleQueueId)
    })

    return await handlers.handle(event)
  }
)
