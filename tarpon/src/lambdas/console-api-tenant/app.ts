import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { shortId } from '@flagright/lib/utils'
import createHttpError from 'http-errors'
import { compact, isEmpty, isEqual } from 'lodash'
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
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Permission } from '@/@types/openapi-internal/Permission'
import { CrmService } from '@/services/crm'
import { NangoService } from '@/services/nango'
import { FEATURE_FLAG_PROVIDER_MAP } from '@/services/sanctions/data-fetchers'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = [
  'features',
  'limits',
  'isAccountSuspended',
]

const assertSettings = (settings: TenantSettings) => {
  const settingsKeys = Object.keys(settings).filter(
    (key) => settings[key as keyof TenantSettings] != null
  )

  const userPermissions: Permission[] = Array.from(
    getContext()?.authz?.permissions.keys() ?? []
  )

  // We cannot make new api for every settings page hence we are using this
  const settingPermissions: Partial<
    Record<keyof TenantSettings, Permission[]>
  > = {
    defaultValues: ['settings:system-config:write'],
    isProductionAccessEnabled: ['settings:system-config:write'],
    mfaEnabled: ['settings:security:write'],
    passwordResetDays: ['settings:security:write'],
    accountDormancyAllowedDays: ['settings:security:write'],
    sessionTimeoutMinutes: ['settings:security:write'],
    maxActiveSessions: ['settings:security:write'],
    isPaymentApprovalEnabled: ['settings:transactions:write'],
    transactionStateAlias: ['settings:transactions:write'],
    kycUserStatusLock: ['settings:transactions:write'],
    pepStatusLock: ['settings:transactions:write'],
    consoleTags: ['settings:transactions:write'],
    ruleActionAliases: ['settings:rules:write'],
    riskLevelAlias: ['settings:risk-scoring:write'],
    notificationsSubscriptions: ['settings:notifications:write'],
    isAiEnabled: ['settings:add-ons:write'],
    isMlEnabled: ['settings:add-ons:write'],
    webhookSettings: ['settings:developers:write'],
  }

  let hasPermission = true

  for (const setting of settingsKeys) {
    if (!settingPermissions[setting]?.length) {
      continue
    }

    if (
      !settingPermissions[setting]?.every((permission) =>
        userPermissions.includes(permission)
      )
    ) {
      hasPermission = false
    }
  }

  if (!hasPermission) {
    throw new createHttpError.Forbidden(
      `User does not have permission to change settings`
    )
  }
}

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
      const newTenantSettings = request.TenantSettings
      const tenantSettingsCurrent = await tenantSettings(ctx.tenantId)
      const changedTenantSettings: TenantSettings = Object.fromEntries(
        Object.entries(newTenantSettings).filter(
          ([key, value]) => !isEqual(value, tenantSettingsCurrent[key])
        )
      )
      assertSettings(changedTenantSettings)
      const dynamoDb = getDynamoDbClientByEvent(event)

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
      const tenantRepository = new TenantRepository(tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
      })
      const settings = await tenantRepository.getTenantSettings([
        'sanctions',
        'features',
      ])
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
          const providers = compact(
            settings.features?.map(
              (feature) => FEATURE_FLAG_PROVIDER_MAP[feature]
            )
          )
          if (!providers) {
            throw new createHttpError.BadRequest('No providers found')
          }
          await sendBatchJobCommand({
            type: 'SANCTIONS_DATA_FETCH',
            tenantId: tenantId,
            parameters: {},
            providers: providers,
          })
          break
        }
        case 'SYNC_AUTH0_DATA': {
          await sendBatchJobCommand({
            type: 'SYNC_AUTH0_DATA',
            tenantId: FLAGRIGHT_TENANT_ID,
            parameters: {
              type: 'ALL',
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
      return await tenantService.getTenantsDeletionData()
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

    handlers.registerPostTenantsCrmIntegrations(async (ctx, request) => {
      const crmService = new CrmService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )
      return await crmService.manageIntegrations(request.CRMIntegrations)
    })

    handlers.registerGetTenantsCrmIntegrations(async (ctx) => {
      const crmService = new CrmService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )
      return await crmService.getIntegrations()
    })

    handlers.registerGetCrmTickets(async (ctx, request) => {
      const nangoService = new NangoService(getDynamoDbClientByEvent(event))

      const crmRecordParams = {
        model: request.model ?? '',
        email: request.email ?? '',
        page: request.page ?? 1,
        pageSize: request.pageSize ?? DEFAULT_PAGE_SIZE,
        sortField: request.sortField ?? '',
        sortOrder: request.sortOrder || 'ascend',
      }

      return await nangoService.getCrmNangoRecords(
        ctx.tenantId,
        crmRecordParams
      )
    })

    handlers.registerPatchTenantsCrmIntegrations(async (ctx, request) => {
      const nangoService = new NangoService(getDynamoDbClientByEvent(event))

      await nangoService.deleteCredentials(
        ctx.tenantId,
        request.CRMIntegrationsPatchPayload.integrationsToDelete ?? []
      )
    })

    /* Action Reasons */

    handlers.registerGetActionReasons(async (ctx, request) => {
      const reasonsService = new ReasonsService(tenantId, mongoDb)
      const type = request.type
      return await reasonsService.getReasons(type)
    })

    handlers.registerCreateActionReasons(async (ctx, request) => {
      const reasonsService = new ReasonsService(tenantId, mongoDb)
      const reason = request.ConsoleActionReasonCreationRequest
      return await reasonsService.addReasons(reason)
    })

    handlers.registerToggleActionReason(async (ctx, request) => {
      const reasonsService = new ReasonsService(tenantId, mongoDb)

      return await reasonsService.enableOrDisableReason(
        request.reasonId,
        request.ConsoleActionReasonPutRequest.isActive
      )
    })

    return await handlers.handle(event)
  }
)
