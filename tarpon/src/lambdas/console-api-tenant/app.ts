import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { hasResources, Resource, shortId } from '@flagright/lib/utils'
import createHttpError, { BadRequest } from 'http-errors'
import isEmpty from 'lodash/isEmpty'
import isEqual from 'lodash/isEqual'
import random from 'lodash/random'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  JWTAuthorizerResult,
  assertCurrentUserRole,
  assertCurrentUserRoleAboveAdmin,
  assertHasDangerousTenantDelete,
} from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { publishAuditLog } from '@/services/audit-log'
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
import { getFullTenantId, isDemoTenant } from '@/utils/tenant-id'
import {
  addSentryExtras,
  tenantSettings,
  userStatements,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { SLAPolicyService } from '@/services/tenants/sla-policy-service'
import { NangoService } from '@/services/nango'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import {
  COLLECTIONS_MAP,
  getDefaultProviders,
  isSanctionsDataFetchTenantSpecific,
} from '@/services/sanctions/utils'
import { TenantFeatures } from '@/@types/openapi-internal/TenantFeatures'
import { getClickhouseCredentials } from '@/utils/clickhouse/client'
import { createApiUsageJobs, toggleApiKeys } from '@/utils/api-usage'
import { MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE } from '@/constants/clickhouse/clickhouse-mongo-map'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { logger } from '@/core/logger'

const ROOT_ONLY_SETTINGS: Array<keyof TenantSettings> = [
  'features',
  'limits',
  'isAccountSuspended',
]

export const assertSettings = (
  settings: TenantSettings,
  statements: PermissionStatements[]
) => {
  const settingsKeys = Object.keys(settings).filter(
    (key) => settings[key as keyof TenantSettings] != null
  ) as (keyof TenantSettings)[]

  // We cannot make new api for every settings page hence we are using this
  const settingPermissions: Partial<Record<keyof TenantSettings, Resource[]>> =
    {
      defaultValues: ['write:::settings/system-config/*'],
      isProductionAccessEnabled: ['write:::settings/system-config/*'],
      mfaEnabled: ['write:::settings/security/*'],
      passwordResetDays: ['write:::settings/security/*'],
      accountDormancyAllowedDays: ['write:::settings/security/*'],
      sessionTimeoutMinutes: ['write:::settings/security/*'],
      maxActiveSessions: ['write:::settings/security/*'],
      isPaymentApprovalEnabled: ['write:::settings/transactions/*'],
      transactionStateAlias: ['write:::settings/transactions/*'],
      kycUserStatusLock: ['write:::settings/transactions/*'],
      pepStatusLock: ['write:::settings/transactions/*'],
      consoleTags: ['write:::settings/transactions/*'],
      ruleActionAliases: ['write:::settings/rules/*'],
      riskLevelAlias: ['write:::settings/risk-scoring/*'],
      notificationsSubscriptions: ['write:::settings/notifications/*'],
      isAiEnabled: ['write:::settings/add-ons/*'],
      isMlEnabled: ['write:::settings/add-ons/*'],
      webhookSettings: ['write:::settings/developers/*'],
      crmIntegrationName: ['write:::settings/users/*'],
      bruteForceAccountBlockingEnabled: [
        'write:::settings/security/brute-force-account-blocking/*',
      ],
      narrativeMode: ['write:::settings/case-management/narrative-copilot/*'],
      batchRerunRiskScoringFrequency: [
        'write:::settings/risk-scoring/batch-rerun-risk-scoring-settings/*',
      ],
      aiSourcesDisabled: ['write:::settings/add-ons/ai-features/*'],
    }

  for (const settingsKey of settingsKeys) {
    const requiredResources = settingPermissions[settingsKey] as
      | Resource[]
      | undefined

    if (!requiredResources?.length) {
      continue
    }

    const hasPermission = hasResources(statements, requiredResources)

    if (!hasPermission) {
      throw new createHttpError.Forbidden(
        `User does not have permission to change settings`
      )
    }
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

    handlers.registerGetTenant(async (ctx) => {
      const { tenantId } = ctx
      const tenantService = new TenantService(ctx.tenantId, {
        mongoDb,
        dynamoDb: getDynamoDbClientByEvent(event),
      })
      const tenant = await tenantService.getTenantById(tenantId)
      return tenant
    })

    handlers.registerPostCreateTenant(async (ctx, request) => {
      assertCurrentUserRole('root')
      // check for tenant id before taking any action
      const newTenantId = request.TenantCreationRequest.tenantId ?? shortId(10)
      if (newTenantId && isDemoTenant(newTenantId)) {
        throw new BadRequest('Tenant id should not end with -test')
      }
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantService = new TenantService(newTenantId, {
        mongoDb,
        dynamoDb,
      })
      try {
        const response = await tenantService.createTenant(
          request.TenantCreationRequest
        )
        return response
      } catch (e) {
        addSentryExtras({
          request: JSON.stringify(request.TenantCreationRequest, null, 2),
        })
        throw createHttpError(400, (e as Error).message)
      }
    })

    handlers.registerGetTenantsSettings(
      async (ctx, request) =>
        await new TenantService(ctx.tenantId, {
          dynamoDb: getDynamoDbClientByEvent(event),
          mongoDb,
        }).getTenantSettings(request.unmaskDowJonesPassword)
    )

    handlers.registerPostTenantsSettings(async (ctx, request) => {
      const newTenantSettings = request.TenantSettings

      // setting 0 as undefined, to reset maxActiveSession
      if (newTenantSettings.maxActiveSessions === 0) {
        newTenantSettings.maxActiveSessions = undefined
      }

      const tenantSettingsCurrent = await tenantSettings(ctx.tenantId)
      const changedTenantSettings: TenantSettings = Object.fromEntries(
        Object.entries(newTenantSettings).filter(
          ([key, value]) => !isEqual(value, tenantSettingsCurrent[key])
        )
      )
      const statements = await userStatements()

      assertSettings(changedTenantSettings, statements)
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

      // toggling usage plan
      if (changedTenantSettings.isAccountSuspended != null) {
        await toggleApiKeys(tenantId, !changedTenantSettings.isAccountSuspended)
      }

      const auditLog: AuditLog = {
        type: 'TENANT',
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
    const clickhouseConfig = await getClickhouseCredentials(tenantId)
    const narrativeService = new NarrativeService(
      tenantId,
      mongoDb,
      clickhouseConfig
    )
    handlers.registerGetNarratives(
      async (ctx, request) =>
        await narrativeService.getNarrativeTemplates(request)
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
        case 'PERIODIC_SCREENING_USER_RULE': {
          await sendBatchJobCommand({
            type: 'PERIODIC_SCREENING_USER_RULE',
            tenantId,
          })
          break
        }

        case 'DEMO_MODE_DATA_LOAD': {
          const tenantId = getFullTenantId(ctx.tenantId, true)
          const batchJobRepository = new BatchJobRepository(tenantId, mongoDb)
          const isAnyJobRunning = await batchJobRepository.isAnyJobRunning(
            'DEMO_MODE_DATA_LOAD'
          )

          if (isAnyJobRunning) {
            logger.warn(
              `Demo mode data load is already running for tenant ${tenantId}`,
              { tenantId }
            )
            return
          }

          await sendBatchJobCommand({
            type: 'DEMO_MODE_DATA_LOAD',
            tenantId,
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
          const providers = getDefaultProviders()
          if (!providers) {
            throw new createHttpError.BadRequest('No providers found')
          }
          for (const provider of providers) {
            if (isSanctionsDataFetchTenantSpecific([provider])) {
              await sendBatchJobCommand({
                type: 'SANCTIONS_DATA_FETCH',
                tenantId: tenantId,
                parameters: {},
                providers: [provider],
              })
            } else if (COLLECTIONS_MAP[provider]) {
              const entityTypes = COLLECTIONS_MAP[provider]
              for (const entityType of entityTypes) {
                await sendBatchJobCommand({
                  type: 'SANCTIONS_DATA_FETCH',
                  tenantId: 'flagright',
                  parameters: {
                    entityType,
                  },
                  providers: [provider],
                })
              }
            }
          }
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
        case 'FAILING_BATCH_JOB': {
          await sendBatchJobCommand({
            type: 'FAILING_BATCH_JOB',
            tenantId: tenantId,
          })
          break
        }
        case 'API_USAGE_METRICS': {
          const tenantInfos = await TenantService.getAllTenants(
            process.env.ENV as Stage,
            process.env.REGION as FlagrightRegion,
            true
          )
          await createApiUsageJobs(tenantInfos)
          break
        }
        case 'PNB_PULL_USERS_DATA': {
          await sendBatchJobCommand({
            type: 'PNB_PULL_USERS_DATA',
            tenantId: tenantId,
          })
          break
        }
        case 'SCREENING_ALERTS_EXPORT': {
          await sendBatchJobCommand({
            type: 'SCREENING_ALERTS_EXPORT',
            tenantId: tenantId,
            parameters: {
              includeMatchedEntityDetails: true,
            },
          })
          break
        }
        case 'CLICKHOUSE_DATA_BACKFILL': {
          await sendBatchJobCommand({
            type: 'CLICKHOUSE_DATA_BACKFILL',
            tenantId: tenantId,
            parameters: {
              type: { type: 'ALL' },
              referenceId: random(Number.MAX_SAFE_INTEGER).toString(),
              tableNames: Object.values(
                MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE
              ),
            },
          })
          break
        }
        case 'SYNC_DATABASES': {
          await sendBatchJobCommand({
            type: 'SYNC_DATABASES',
            tenantId: tenantId,
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
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await slaPolicyService.getSLAPolicies(request)
    })

    handlers.registerGetSlaPolicy(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      const policyId = request.slaId
      const policy = await slaPolicyService.getSLAPolicyById(policyId)

      if (!policy || policy.isDeleted) {
        throw new createHttpError.NotFound('SLA Policy not found')
      }

      return policy
    })

    handlers.registerPostSlaPolicy(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await slaPolicyService.createSLAPolicy(request.SLAPolicy)
    })

    handlers.registerPutSlaPolicy(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await slaPolicyService.updateSLAPolicy(request.SLAPolicy)
    })

    handlers.registerDeleteSlaPolicy(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await slaPolicyService.deleteSLAPolicy(request.slaId)
    })

    handlers.registerGetNewSlaId(async (ctx) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const slaPolicyService = new SLAPolicyService(ctx.tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await slaPolicyService.getSLAPolicyId()
    })

    handlers.registerGetCrmRecords(async (ctx, request) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )

      return await nangoService.getCrmNangoRecords(request)
    })

    handlers.registerGetCrmRecordsSearch(async (ctx, request) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )

      return await nangoService.getCrmRecordsSearch(request)
    })

    handlers.registerPostCrmRecordLink(async (ctx, request) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )

      await nangoService.linkCrmRecord({
        crmName: request.CRMRecordLink.crmName,
        recordType: request.CRMRecordLink.recordType,
        crmRecordId: request.CRMRecordLink.id,
        userId: request.CRMRecordLink.userId,
      })
    })

    /* Action Reasons */

    handlers.registerGetTenantsNangoConnections(async (ctx) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )
      return await nangoService.createConnectSession()
    })

    handlers.registerPostTenantsNangoConnections(async (ctx, request) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )
      return await nangoService.postConnectSession(
        ctx.tenantId,
        request.NangoPostConnect
      )
    })

    handlers.registerDeleteTenantsNangoConnections(async (ctx, request) => {
      const nangoService = new NangoService(
        ctx.tenantId,
        getDynamoDbClientByEvent(event)
      )
      return await nangoService.deleteConnection(request.NangoPostConnect)
    })

    handlers.registerGetActionReasons(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const reasonsService = new ReasonsService(tenantId, {
        mongoDb,
        dynamoDb,
      })
      const type = request.type
      return await reasonsService.getReasons(type)
    })

    handlers.registerCreateActionReasons(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const reasonsService = new ReasonsService(tenantId, {
        mongoDb,
        dynamoDb,
      })
      const reason = request.ConsoleActionReasonCreationRequest
      return await reasonsService.addReasons(reason)
    })

    handlers.registerToggleActionReason(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const reasonsService = new ReasonsService(tenantId, {
        mongoDb,
        dynamoDb,
      })

      return await reasonsService.enableOrDisableReason(
        request.reasonId,
        request.ConsoleActionReasonPutRequest.reasonType,
        request.ConsoleActionReasonPutRequest.isActive
      )
    })

    handlers.registerGetTenantsFeatures(async () => {
      const features = await TenantService.pullAllTenantsFeatures()
      const tenantFeatures: TenantFeatures[] = Object.entries(features).map(
        ([tenantId, { tenantName, region, features }]) => ({
          tenantId,
          tenantName,
          region,
          features,
        })
      )
      return tenantFeatures
    })

    handlers.registerGetBulkRerunRiskScoringBatchJobStatus(async (ctx) => {
      const tenantService = new TenantService(ctx.tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
        mongoDb,
      })
      return await tenantService.getBatchJobBulkRerunRiskScoringStatus()
    })

    handlers.registerPostBatchJobBulkRerunRiskScoring(async (ctx) => {
      const tenantService = new TenantService(ctx.tenantId, {
        dynamoDb: getDynamoDbClientByEvent(event),
        mongoDb,
      })
      return await tenantService.postBatchJobBulkRerunRiskScoring()
    })

    handlers.registerGetTenantsSecondaryQueueTenants(async () => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      return { tenants: await TenantService.getSecondaryQueueTenants(dynamoDb) }
    })

    handlers.registerPostTenantsSecondaryQueueTenants(async (ctx, request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantService = new TenantService(FLAGRIGHT_TENANT_ID, {
        mongoDb,
        dynamoDb,
      })
      await tenantService.setSecondaryQueueTenants(
        request.SecondaryQueueTenants?.tenants ?? []
      )
      return {
        tenants: request.SecondaryQueueTenants?.tenants ?? [],
      }
    })

    return await handlers.handle(event)
  }
)
