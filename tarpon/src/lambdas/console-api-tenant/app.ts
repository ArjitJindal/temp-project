import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { shortId } from '@flagright/lib/utils'
import createHttpError from 'http-errors'
import { isEmpty, isEqual } from 'lodash'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  JWTAuthorizerResult,
  assertCurrentUserRole,
  assertCurrentUserRoleAboveAdmin,
  assertHasDangerousTenantDelete,
} from '@/@types/jwt'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { publishAuditLog } from '@/services/audit-log'
import { envIsNot } from '@/utils/env'
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
import { getFullTenantId } from '@/utils/tenant'
import {
  addSentryExtras,
  getContext,
  tenantSettings,
} from '@/core/utils/context'
import { SLAPolicyService } from '@/services/tenants/sla-policy-service'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = [
  'features',
  'limits',
  'isAccountSuspended',
]

export const tenantsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, auth0Domain } =
      event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const handlers = new Handlers()

    handlers.registerGetTenantsList(async (ctx) => {
      assertCurrentUserRoleAboveAdmin()
      const tenantService = new TenantService(ctx.tenantId, {
        mongoDb,
        dynamoDb: getDynamoDbClientByEvent(event),
      })
      return await tenantService.getAllTenants(auth0Domain)
    })

    handlers.registerPostCreateTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      const newTenantId = shortId(10)
      const dynamoDb = getDynamoDbClient()
      const tenantService = new TenantService(
        request.TenantCreationRequest.tenantId ?? newTenantId,
        { mongoDb, dynamoDb }
      )
      try {
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
      } catch (e) {
        addSentryExtras({
          request: JSON.stringify(request.TenantCreationRequest, null, 2),
        })
        throw createHttpError(400, (e as Error).message)
      }
    })

    handlers.registerGetTenantsSettings(
      async (ctx) =>
        await new TenantService(ctx.tenantId, {
          dynamoDb: getDynamoDbClientByEvent(event),
          mongoDb,
        }).getTenantSettings()
    )

    handlers.registerPostTenantsSettings(async (ctx, request) => {
      assertCurrentUserRole('admin')
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantSettingsCurrent = await tenantSettings(ctx.tenantId)
      const newTenantSettings = request.TenantSettings

      const changedTenantSettings = Object.fromEntries(
        Object.entries(newTenantSettings).filter(
          ([key, value]) => !isEqual(value, tenantSettingsCurrent[key])
        )
      ) as TenantSettings

      if (isEmpty(changedTenantSettings)) {
        return tenantSettingsCurrent
      }

      if (
        ROOT_ONLY_SETTINGS.find(
          (settingName) => changedTenantSettings[settingName]
        )
      ) {
        assertCurrentUserRole('root')
        if (changedTenantSettings.isAccountSuspended != null) {
          assertHasDangerousTenantDelete()
        }
      }

      const user = getContext()?.user

      if (
        user?.role === 'root' &&
        tenantSettingsCurrent.isProductionAccessEnabled === false
      ) {
        const isAnyKeyOutsideRootOnlySettings = Object.keys(
          changedTenantSettings
        ).some(
          (key) => !ROOT_ONLY_SETTINGS.includes(key as keyof TenantSettings)
        )

        if (isAnyKeyOutsideRootOnlySettings) {
          throw new createHttpError.Forbidden(
            'Root users can only change root-only settings when production access is disabled'
          )
        }
      }

      const tenantService = new TenantService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      const updatedResult = await tenantService.createOrUpdateTenantSettings(
        changedTenantSettings
      )

      const auditLog: AuditLog = {
        type: 'ACCOUNT',
        action: 'UPDATE',
        timestamp: Date.now(),
        oldImage: tenantSettingsCurrent,
        newImage: { ...tenantSettingsCurrent, ...changedTenantSettings },
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
        case 'ONGOING_SCREENING_USER_RULE': {
          await sendBatchJobCommand({
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
          })
          break
        }
        case 'PULSE_USERS_BACKFILL_RISK_SCORE': {
          await sendBatchJobCommand({
            type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
            tenantId: tenantId,
            awsCredentials: getCredentialsFromEvent(event),
            parameters: {
              userIds: [],
            },
          })
          break
        }
        case 'DEMO_MODE_DATA_LOAD': {
          await sendBatchJobCommand({
            type: 'DEMO_MODE_DATA_LOAD',
            tenantId: getFullTenantId(ctx.tenantId, true),
            awsCredentials: getCredentialsFromEvent(event),
          })
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
        case 'SANCTIONS_DATA_FETCH': {
          await sendBatchJobCommand({
            type: 'SANCTIONS_DATA_FETCH',
            tenantId: 'flagright',
            parameters: {},
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
    const ruleQueueService = new RuleQueuesService(tenantId, {
      mongoDb,
      dynamoDb: getDynamoDbClientByEvent(event),
    })

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

      const tenantService = new TenantService(ctx.tenantId, {
        mongoDb,
        dynamoDb: getDynamoDbClientByEvent(event),
      })

      if (!request.DeleteTenant.tenantId) {
        throw createHttpError(400, 'tenantId is required')
      }

      await tenantService.deleteTenant(
        request.DeleteTenant.tenantId,
        request.DeleteTenant.notRecoverable
      )

      return
    })

    handlers.registerDeleteRuleQueue(
      async (ctx, request) =>
        await ruleQueueService.deleteQueue(request.ruleQueueId)
    )

    handlers.registerGetTenantsDeletionData(async (ctx) => {
      const tenantService = new TenantService(ctx.tenantId, {
        mongoDb,
        dynamoDb: getDynamoDbClientByEvent(event),
      })
      return await tenantService.getTenantsDeletionData(auth0Domain)
    })
    /* SLA Policies */
    handlers.registerGetSlaPolicies(async (ctx, request) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      return await slaPolicyService.getSLAPolicies(request)
    })

    handlers.registerGetSlaPolicy(async (ctx, request) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      const policyId = request.slaId
      const policy = await slaPolicyService.getSLAPolicyById(policyId)

      if (!policy || policy.isDeleted) {
        throw new createHttpError.NotFound('SLA Policy not found')
      }

      return policy
    })

    handlers.registerPostSlaPolicy(async (ctx, request) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      return await slaPolicyService.createSLAPolicy(request.SLAPolicy)
    })

    handlers.registerPutSlaPolicy(async (ctx, request) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      return await slaPolicyService.updateSLAPolicy(request.SLAPolicy)
    })

    handlers.registerDeleteSlaPolicy(async (ctx, request) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      return await slaPolicyService.deleteSLAPolicy(request.slaId)
    })

    handlers.registerGetNewSlaId(async (ctx) => {
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, mongoDb)
      return await slaPolicyService.getSLAPolicyId()
    })
    return await handlers.handle(event)
  }
)
