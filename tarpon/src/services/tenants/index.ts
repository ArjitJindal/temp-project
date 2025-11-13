import { MongoClient } from 'mongodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayClient,
  ApiKey,
  ApiStage,
  CreateUsagePlanCommand,
  GetApiKeyCommand,
  GetRestApisCommand,
  GetUsageCommand,
  GetUsagePlanKeysCommand,
  RestApi,
  ThrottleSettings,
  UpdateApiKeyCommand,
} from '@aws-sdk/client-api-gateway'
import { StackConstants } from '@lib/constants'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import createHttpError, { BadRequest, InternalServerError } from 'http-errors'
import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import {
  doesUsagePlanExist,
  getAllUsagePlans,
  USAGE_PLAN_REGEX,
} from '@flagright/lib/tenants/usage-plans'
import compact from 'lodash/compact'
import flatten from 'lodash/flatten'
import isEmpty from 'lodash/isEmpty'
import uniq from 'lodash/uniq'
import { stageAndRegion } from '@flagright/lib/utils'
import { siloDataTenants } from '@flagright/lib/constants/silo-data-tenants'
import pMap from 'p-map'
import { createNewApiKeyForTenant } from '../api-key'
import { RuleInstanceService } from '../rules-engine/rule-instance-service'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { RISK_FACTORS } from '../risk-scoring/risk-factors'
import { CounterRepository } from '../counter/repository'
import { BatchRerunUsersService } from '../batch-users-rerun'
import { TenantRepository } from './repositories/tenant-repository'
import { ReasonsService } from './reasons-service'
import { ScreeningProfileService } from '@/services/screening-profile'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { TenantCreationResponse } from '@/@types/openapi-internal/TenantCreationResponse'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountsService } from '@/services/accounts'
import { checkMultipleEmails } from '@/utils/helpers'
import { getAuth0Domain, isWhitelabelAuth0Domain } from '@/utils/auth0-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { traceable } from '@/core/xray'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { TenantUsageData } from '@/@types/openapi-internal/TenantUsageData'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { TenantApiKey } from '@/@types/openapi-internal/TenantApiKey'
import { assertCurrentUserRole, isFlagrightInternalUser } from '@/@types/jwt'
import {
  sanitizeTenantSettings,
  tenantSettings,
  updateTenantSettings,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { getNonDemoTenantId, isDemoTenant } from '@/utils/tenant-id'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongo-table-names'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { Feature } from '@/@types/openapi-internal/Feature'
import { FormulaSimpleAvg } from '@/@types/openapi-internal/FormulaSimpleAvg'
import { FormulaLegacyMovingAvg } from '@/@types/openapi-internal/FormulaLegacyMovingAvg'
import { FormulaCustom } from '@/@types/openapi-internal/FormulaCustom'
import { logger } from '@/core/logger'
import {
  batchWrite,
  BatchWriteRequestInternal,
  getDynamoDbClient,
} from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { auditLog } from '@/utils/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import {
  bulkSendMessages,
  getSQSClient,
  getSQSQueueUrl,
} from '@/utils/sns-sqs-client'
import { AuditLogRecord } from '@/@types/audit-log'
import { generateChecksum } from '@/utils/object'

export type TenantInfo = {
  tenant: Tenant
  auth0Domain: string
  auth0TenantConfig: Auth0TenantConfig
}

const region = envIs('local')
  ? 'eu-central-1'
  : process.env.AWS_REGION || 'eu-central-1'

const tenantCache = createNonConsoleApiInMemoryCache<TenantInfo[]>({
  max: 100,
  ttlMinutes: 10,
})

const secondaryQueueTenantsCache = createNonConsoleApiInMemoryCache<string[]>({
  max: 100,
  ttlMinutes: 10,
})

@traceable
export class TenantService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: { dynamoDb?: DynamoDBDocumentClient; mongoDb: MongoClient }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb
    this.tenantId = tenantId
  }

  private async algorithmChangeCapture(
    oldAlgorithm: string | undefined,
    newAlgorithm: string | undefined
  ) {
    if (
      oldAlgorithm === 'FORMULA_LEGACY_MOVING_AVG' &&
      (newAlgorithm === 'FORMULA_SIMPLE_AVG' ||
        newAlgorithm === 'FORMULA_CUSTOM')
    ) {
      await sendBatchJobCommand({
        type: 'BACKFILL_AVERAGE_TRS',
        tenantId: this.tenantId,
      })
    }
  }

  public static async getSecondaryQueueTenants(
    dynamoDb: DynamoDBDocumentClient
  ): Promise<string[]> {
    const cacheKey = getInMemoryCacheKey('secondary-queue-tenants')
    if (secondaryQueueTenantsCache?.has(cacheKey)) {
      return secondaryQueueTenantsCache.get(cacheKey) ?? []
    }
    const tenantRepository = new TenantRepository(FLAGRIGHT_TENANT_ID, {
      dynamoDb,
    })
    const tenants = await tenantRepository.getSecondaryQueueTenants()
    secondaryQueueTenantsCache?.set(cacheKey, tenants)
    return tenants
  }

  public async setSecondaryQueueTenants(tenants: string[]): Promise<void> {
    const cacheKey = getInMemoryCacheKey('secondary-queue-tenants')
    secondaryQueueTenantsCache?.set(cacheKey, tenants)
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    await tenantRepository.setSecondaryQueueTenants(tenants)
  }

  private async featureFlagChangeCapture(
    oldFeatures: Feature[],
    newFeatures: Feature[]
  ) {
    const handlers: Partial<
      Record<
        'ENABLED' | 'DISABLED',
        Partial<Record<Feature, () => Promise<void>>>
      >
    > = {
      ENABLED: {
        RULES_ENGINE_V8_FOR_V2_RULES: async () => {
          const service = new RuleInstanceService(this.tenantId, {
            dynamoDb: this.dynamoDb,
            mongoDb: this.mongoDb,
          })
          await service.preAggregateV2RuleInstance()
        },
      },
      DISABLED: {
        RULES_ENGINE_V8_FOR_V2_RULES: async () =>
          RuleInstanceService.bumpV2RuleInstanceAggregationVersion(
            this.tenantId
          ),
      },
    }

    const featuresAdded = newFeatures.filter(
      (feature) => !oldFeatures.includes(feature)
    )

    const featuresRemoved = oldFeatures.filter(
      (feature) => !newFeatures.includes(feature)
    )

    for (const feature of featuresAdded) {
      await handlers.ENABLED?.[feature]?.()
    }

    for (const feature of featuresRemoved) {
      await handlers.DISABLED?.[feature]?.()
    }
  }

  public static getTenantsToDelete = async (): Promise<DeleteTenant[]> => {
    const mongoDb = await getMongoDbClient()
    const collectionName = TENANT_DELETION_COLLECTION
    const collection = mongoDb.db().collection<DeleteTenant>(collectionName)
    const tenantsToDeleteResult = await collection
      .find({
        $or: [
          {
            latestStatus: 'WAITING_HARD_DELETE',
            hardDeleteTimestamp: { $lte: dayjs().valueOf() },
          },
          {
            latestStatus: { $in: ['FAILED', 'PENDING'] },
          },
        ],
      })
      .toArray()

    return tenantsToDeleteResult
  }

  public static getAllTenants = async (
    stage?: Stage,
    region?: FlagrightRegion | 'asia-2',
    useCache: boolean = false
  ): Promise<TenantInfo[]> => {
    const cacheKey = getInMemoryCacheKey(stage, region, 'tenants-cache')
    const cachedTenants = tenantCache?.get(cacheKey)

    if (cachedTenants) {
      return cachedTenants
    }

    const stageOrDefault = stage ?? (process.env.ENV?.split(':')[0] as Stage)
    const regionOrDefault = region ?? (process.env.REGION as FlagrightRegion)
    const dynamoDb = getDynamoDbClient()
    const tenantInfos: Array<TenantInfo> = []
    const auth0TenantConfigs = getAuth0TenantConfigs(
      stageOrDefault,
      regionOrDefault
    )
    for (const auth0TenantConfig of auth0TenantConfigs) {
      const auth0Domain = getAuth0Domain(
        auth0TenantConfig.tenantName,
        auth0TenantConfig.region
      )
      const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })
      tenantInfos.push(
        ...(await accountsService.getTenants(undefined, useCache)).map(
          (tenant) => ({
            tenant,
            auth0Domain,
            auth0TenantConfig,
          })
        )
      )
    }

    const result = region
      ? tenantInfos.filter(
          (tenantInfo) =>
            !tenantInfo.tenant.region ||
            tenantInfo.tenant.region === regionOrDefault
        )
      : tenantInfos

    tenantCache?.set(cacheKey, result)

    return result
  }

  static async pullAllTenantsFeatures(): Promise<
    Record<
      string,
      {
        tenantName: string
        region: string
        features: Feature[]
      }
    >
  > {
    const tenants = await TenantService.getAllTenants(
      process.env.ENV?.split(':')[0] as Stage,
      process.env.REGION as FlagrightRegion,
      true
    )
    const features: Record<
      string,
      { tenantName: string; region: string; features: Feature[] }
    > = {}
    const dynamoDb = getDynamoDbClient()
    for (const tenant of tenants) {
      const tenantRepository = new TenantRepository(tenant.tenant.id, {
        dynamoDb,
      })
      const tenantSettings = await tenantRepository.getTenantSettings([
        'features',
      ])

      if (!tenantSettings.features || !tenant.tenant.id) {
        continue
      }

      features[tenant.tenant.id] = {
        tenantName: tenant.tenant.name,
        region: tenant.tenant.region,
        features: tenantSettings.features,
      }
    }

    return features
  }

  async createDefaultScreeningProfile(tenantId: string) {
    const mongoDb = this.mongoDb
    const dynamoDb = this.dynamoDb
    const counterRepository = new CounterRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const screeningProfileService = new ScreeningProfileService(tenantId, {
      dynamoDb,
    })
    await screeningProfileService.createDefaultScreeningProfile(
      counterRepository
    )
  }

  private async generateTenantApiKey(tenantId: string, usagePlanId: string) {
    try {
      const { newApiKey: apiKey, apiKeyId } = await createNewApiKeyForTenant(
        tenantId,
        usagePlanId
      )
      return { apiKey, usagePlanId, apiKeyId }
    } catch (e) {
      logger.error(`Unable to create api key ${e}`)
      throw new InternalServerError('Unable to create api key')
    }
  }

  async createTenant(
    tenantData: TenantCreationRequest
  ): Promise<TenantCreationResponse> {
    if (!tenantData.tenantName || !tenantData.tenantWebsite) {
      throw new BadRequest('Tenant name, website and website are required')
    }

    if (tenantData.siloDataMode) {
      const [stage, region] = stageAndRegion()
      if (!tenantData.tenantId) {
        throw new BadRequest(
          `Tenant id is required for silo data mode in ${process.env.ENV} and region ${process.env.REGION}`
        )
      }

      const siloDataTenantIds = siloDataTenants?.[stage]?.[region] ?? []
      logger.info(
        `Silo data tenant ids: ${siloDataTenantIds}, tenant id: ${tenantData.tenantId}, env: ${stage}, region: ${region}`
      )

      if (!siloDataTenantIds.includes(tenantData.tenantId)) {
        throw new BadRequest(
          `Tenant id ${tenantData.tenantId} is not enabled for silo data mode in ${process.env.ENV} and region ${process.env.REGION}. Contact engineering to support this tenant.`
        )
      }
    }

    const accountsService = new AccountsService(
      { auth0Domain: tenantData.auth0Domain },
      { dynamoDb: this.dynamoDb }
    )

    const existingOrganization = await accountsService.getOrganization(
      tenantData.tenantName
    )

    if (existingOrganization) {
      throw new BadRequest(
        `Organization ${tenantData.tenantName} already exists`
      )
    }

    if (
      tenantData?.adminEmails?.length &&
      !checkMultipleEmails(tenantData.adminEmails)
    ) {
      throw new BadRequest('One or more admin emails are invalid')
    }

    if (
      tenantData?.adminEmails?.length &&
      (await accountsService.checkAuth0UserExistsMultiple(
        tenantData.adminEmails
      ))
    ) {
      throw new BadRequest('One or more admin emails already exists')
    }

    tenantData.tenantName = tenantData.tenantName.replace(/[^a-zA-Z0-9]/g, '-')

    const planExists = await doesUsagePlanExist(tenantData.tenantName, region)

    if (planExists) {
      throw new BadRequest(
        `Usage plan for tenant ${tenantData.tenantName} already exists`
      )
    }

    const tenantId = this.tenantId

    const usagePlanId = await this.createUsagePlan(tenantData, tenantId)

    if (usagePlanId == null) {
      throw new Error('Unable to create usage plan')
    }

    await this.generateTenantApiKey(tenantId, usagePlanId)

    const organization = await accountsService.createAuth0Organization(
      tenantData,
      tenantId
    )

    if (tenantData.adminEmails?.length) {
      await accountsService.createAccountInOrganizationMultiple(
        organization,
        tenantData.adminEmails,
        'admin'
      )
    }

    if (!tenantData.siloDataMode) {
      const newTenantSettings: TenantSettings = {
        limits: {
          seats: tenantData.seats ?? 5,
          apiKeyView: 2,
          simulations: tenantData.features.includes('SIMULATOR') ? 10 : 0,
        },
        features: tenantData.features ?? [],
        webhookSettings: {
          retryBackoffStrategy: 'LINEAR',
          retryOnlyFor: ['3XX', '4XX', '5XX'],
          maxRetryHours: 24,
          maxRetryReachedAction: envIs('prod') ? 'IGNORE' : 'DISABLE_WEBHOOK',
        },
        riskScoringAlgorithm: { type: 'FORMULA_SIMPLE_AVG' },
        auth0Domain: tenantData.auth0Domain,
        ...(tenantData.features.includes('CRM') && {
          crmIntegrationName: 'ZENDESK',
        }),
        isAiEnabled: true,
      }

      const dynamoDb = this.dynamoDb
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      await tenantRepository.createOrUpdateTenantSettings(newTenantSettings)
    } else {
      logger.error(
        `Tenant ${tenantId} (${tenantData.tenantName}) created with silo data mode in ${process.env.ENV} and region ${process.env.REGION}. Please add the tenant to the cloudformation stack`
      )
    }

    const reasonsService = new ReasonsService(tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    // initialising default reasons for new tenant
    await reasonsService.initialiseDefaultReasons()

    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const counterRepository = new CounterRepository(tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    // initalising v2 risk factors in v8 for new tenant
    await Promise.all([
      ...RISK_FACTORS.map(async (riskFactor, index) => {
        await riskRepository.createOrUpdateRiskFactor({
          id: `RF-${(index + 1).toString().padStart(3, '0')}`,
          ...riskFactor,
        })
      }),
      await counterRepository.setCounterValue(
        'RiskFactor',
        RISK_FACTORS.length
      ),
    ])

    // Creating default workflows for new tenant
    // NOTE: This might not be needed but should be replaced by templates.
    // TODO: IMPLEMENT THIS!

    await sendBatchJobCommand({
      type: 'SYNC_DATABASES',
      tenantId,
    })

    await this.createDefaultScreeningProfile(tenantId)

    return {
      tenantId,
      tenantName: tenantData.tenantName,
      usagePlanId,
      ...(organization.id && { auth0OrganizationId: organization.id }),
    }
  }

  static async getApiStages(): Promise<ApiStage[] | undefined> {
    const apigateway = new APIGatewayClient({
      region,
    })

    const apiGateways: RestApi[] = []
    let position: string | undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const apiGatewayCommand = new GetRestApisCommand({
        limit: 1000,
        position,
      })

      const apiGatewaysFiltered = await apigateway.send(apiGatewayCommand)

      apiGateways.push(...(apiGatewaysFiltered?.items ?? []))

      if (!apiGatewaysFiltered.position) {
        break
      }

      position = apiGatewaysFiltered.position
    }

    if (!apiGateways?.length) {
      return undefined
    }

    return apiGateways
      .filter((x) => {
        if (
          [
            StackConstants.TARPON_API_NAME,
            StackConstants.TARPON_MANAGEMENT_API_NAME,
          ].includes(x.name ?? '') &&
          x.id
        ) {
          return true
        }
        return false
      })
      .map((x) => ({
        apiId: x.id,
        stage: 'prod',
      }))
  }

  private getUsagePlanName(tenantId: string, tenantName: string): string {
    return `tarpon:${tenantId}:${tenantName}`
  }

  private async getTenantApiKeys() {
    const allUsagePlans = await getAllUsagePlans(region)

    const tenantId = getNonDemoTenantId(this.tenantId)

    const usagePlan = allUsagePlans?.find(
      (x) => x.name?.match(USAGE_PLAN_REGEX)?.[1] === tenantId
    )

    if (!usagePlan) {
      throw new Error(`Usage plan for tenant ${tenantId} not found`)
    }

    const usagePlanId = usagePlan.id

    const apigateway = new APIGatewayClient({
      region,
    })

    const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
      usagePlanId: usagePlanId,
    })

    const usagePlanKeys = await apigateway.send(usagePlanKeysCommand)

    const allApiKeys: ApiKey[] = await Promise.all(
      usagePlanKeys.items?.map(async (usagePlanKey) => {
        const apiKeyCommand = new GetApiKeyCommand({
          apiKey: usagePlanKey.id,
          includeValue: true,
        })

        const apiKey = await apigateway.send(apiKeyCommand)

        return apiKey
      }) ?? []
    )

    return allApiKeys
  }

  public async getApiKeys(unmaskingOptions?: {
    unmask: boolean
    apiKeyId: string
  }): Promise<TenantApiKey[]> {
    const tenantId = getNonDemoTenantId(this.tenantId)

    const allApiKeys = await this.getTenantApiKeys()
    const partitionKey = DynamoDbKeys.DEACTIVATION_MARKED_API_KEY(
      tenantId,
      ''
    ).PartitionKeyID
    const getQueryCommand: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression:
        'PartitionKeyID = :pk and begins_with(SortKeyID, :tenantPrefix)',
      ExpressionAttributeValues: {
        ':pk': partitionKey,
        ':tenantPrefix': `${tenantId}#`,
      },
    }
    const response = await this.dynamoDb.send(new QueryCommand(getQueryCommand))
    // map of apiKeyId and its deletion timstamp
    const data =
      response.Items?.reduce((acc, d) => {
        acc[d.apiKeyId] = d.deactivationTimestamp
        return acc
      }, {}) ?? {}

    const apiKeys: TenantApiKey[] = allApiKeys.map((x) => ({
      id: x.id ?? '',
      createdAt: dayjs(x.createdDate).valueOf(),
      key: x.value ?? '',
      updatedAt: dayjs(x.lastUpdatedDate).valueOf(),
      deactivationTimestamp: data[x.id ?? ''] ?? undefined,
      enabled: x.enabled ?? false,
    }))

    if (unmaskingOptions?.apiKeyId && unmaskingOptions.unmask) {
      const apiKeysProcessed = await this.processApiKeys(
        allApiKeys,
        data,
        unmaskingOptions
      )

      return apiKeysProcessed
    }

    return apiKeys.map((x) => ({
      id: x.id,
      createdAt: x.createdAt,
      key: x.key?.replace(/.(?=.{4})/g, '*'),
      updatedAt: x.updatedAt,
      deactivationTimestamp: data[x.id ?? ''] ?? undefined,
      enabled: x.enabled,
    }))
  }

  private async processApiKeys(
    apiKeys: ApiKey[],
    deactivationTimeMap: { [key: string]: number },
    unmaskingOptions: {
      unmask: boolean
      apiKeyId: string
    }
  ): Promise<TenantApiKey[]> {
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const settings = await tenantSettings(this.tenantId)

    const apiKeyViewTimes =
      settings?.apiKeyViewData?.find(
        (x) => x.apiKey === unmaskingOptions.apiKeyId
      )?.count ?? 0

    const apiKeysProcessed = apiKeys.map((x) => {
      const isTargetKey = x.id === unmaskingOptions.apiKeyId
      let value: string | undefined

      if (isTargetKey && unmaskingOptions.unmask) {
        const exceededViewLimit =
          !isFlagrightInternalUser() &&
          apiKeyViewTimes >= (settings?.limits?.apiKeyView ?? 2)

        value = exceededViewLimit
          ? x.value?.replace(/.(?=.{4})/g, '*')
          : x.value
      } else {
        value = x.value?.replace(/.(?=.{4})/g, '*')
      }

      return {
        id: x.id ?? '',
        createdAt: dayjs(x.createdDate).valueOf(),
        key: value ?? '',
        updatedAt: dayjs(x.lastUpdatedDate).valueOf(),
        deactivationTimestamp: deactivationTimeMap[x.id ?? ''] ?? undefined,
        enabled: x.enabled ?? false,
      }
    })

    const apiKeyViewData = settings?.apiKeyViewData ?? []

    const apiKeyViewDataIndex = apiKeyViewData.findIndex(
      (x) => x.apiKey === unmaskingOptions.apiKeyId
    )

    if (!isFlagrightInternalUser()) {
      if (apiKeyViewDataIndex > -1) {
        apiKeyViewData[apiKeyViewDataIndex].count = apiKeyViewTimes + 1
      } else {
        apiKeyViewData.push({
          apiKey: unmaskingOptions.apiKeyId,
          count: apiKeyViewTimes + 1,
        })
      }

      await tenantRepository.createOrUpdateTenantSettings({
        apiKeyViewData,
      })
    }

    return apiKeysProcessed
  }

  private async getTenantUsagePlanId(tenantId: string) {
    tenantId = getNonDemoTenantId(tenantId)
    const usagePlans = await getAllUsagePlans(region)
    const usagePlan = usagePlans?.find(
      (x) => x.name?.match(USAGE_PLAN_REGEX)?.[1] === tenantId
    )

    if (!usagePlan) {
      throw new Error(`Usage plan for tenant ${tenantId} not found`)
    }
    return usagePlan
  }

  public async getUsagePlanData(tenantId: string): Promise<TenantUsageData> {
    tenantId = getNonDemoTenantId(tenantId)

    const usagePlan = await this.getTenantUsagePlanId(tenantId)

    const apigateway = new APIGatewayClient({
      region,
    })

    const getUsageCommand = new GetUsageCommand({
      usagePlanId: usagePlan.id,
      startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    })

    const usage = await apigateway.send(getUsageCommand)

    const quotaLeftData = Object.values(usage?.items ?? {})?.[0]
    const quotaLeft = quotaLeftData?.[quotaLeftData.length - 1]?.[1]

    return {
      burstCapacityInRps: usagePlan.throttle?.burstLimit ?? 0,
      rateLimitInRps: usagePlan.throttle?.rateLimit ?? 0,
      quotaLimit: process.env.ENV?.startsWith('prod')
        ? 'UNLIMITED'
        : usagePlan.quota?.limit?.toString() ?? '0',
      quotaRenewalRate: process.env.ENV?.startsWith('prod')
        ? 'N/A'
        : usagePlan.quota?.period === 'DAY'
        ? 'Daily'
        : usagePlan.quota?.period === 'WEEK'
        ? 'Weekly'
        : usagePlan.quota?.period === 'MONTH'
        ? 'Monthly'
        : 'Unknown',
      quotaLeft: process.env.ENV?.startsWith('prod')
        ? 'UNLIMITED'
        : String(quotaLeft ?? usagePlan.quota?.limit ?? 0),
    }
  }

  async createUsagePlan(
    tenantData: TenantCreationRequest,
    tenantId: string
  ): Promise<string> {
    let throttleSettings: ThrottleSettings

    if (process.env.ENV?.startsWith('prod')) {
      throttleSettings = { burstLimit: 75, rateLimit: 50 }
    } else {
      throttleSettings = { burstLimit: 6, rateLimit: 3 }
    }

    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
    })

    const createdUsgaePlanCommand = new CreateUsagePlanCommand({
      name: this.getUsagePlanName(tenantId, tenantData.tenantName),
      throttle: throttleSettings,
      apiStages: await TenantService.getApiStages(),
      description: tenantData.tenantWebsite,
      ...(!process.env.ENV?.startsWith('prod') && {
        quota: { limit: 5000, offset: 0, period: 'MONTH' },
      }),
    })

    const createdUsgaePlan = await apigateway.send(createdUsgaePlanCommand)

    const usagePlanId = createdUsgaePlan.id

    if (usagePlanId == null) {
      throw new Error('Unable to create usage plan')
    }

    return usagePlanId
  }

  async createOrUpdateTenantSettings(
    newTenantSettings: Partial<TenantSettings>
  ): Promise<Partial<TenantSettings>> {
    const existingTenantSettings = getContext()?.settings

    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const updatedResult = await tenantRepository.createOrUpdateTenantSettings(
      newTenantSettings
    )
    updateTenantSettings({
      ...existingTenantSettings,
      ...newTenantSettings,
    })

    // Check for removed workflows and auto-apply pending approvals
    if (
      newTenantSettings.workflowSettings &&
      existingTenantSettings?.workflowSettings
    ) {
      await this.handleWorkflowRemovals(
        existingTenantSettings.workflowSettings as Record<string, unknown>,
        newTenantSettings.workflowSettings as Record<string, unknown>
      )
    }

    const isAcurisEnabled =
      newTenantSettings.features?.includes('ACURIS') &&
      !existingTenantSettings?.features?.includes('ACURIS')
    // if acuris is enabled, create a default screening profile
    if (isAcurisEnabled) {
      await this.createDefaultScreeningProfile(this.tenantId)
    }
    const providerScreeningTypes =
      newTenantSettings.sanctions?.providerScreeningTypes
    const acurisSanctionsSearchType = providerScreeningTypes?.find(
      (type) => type.provider === 'acuris'
    )?.screeningTypes
    // if acuris settings are changed, update the screening profiles
    if (acurisSanctionsSearchType) {
      const screeningProfileService = new ScreeningProfileService(
        this.tenantId,
        {
          dynamoDb: this.dynamoDb,
        }
      )
      await screeningProfileService.updateScreeningProfilesOnSanctionsSettingsChange(
        acurisSanctionsSearchType as AcurisSanctionsSearchType[]
      )
    }

    // Update auth0 tenant metadata for the selected tenant setting properties
    if (!isDemoTenant(this.tenantId)) {
      const updateData: Record<string, string> = {}

      if (newTenantSettings.isProductionAccessEnabled != null) {
        updateData.isProductionAccessDisabled = String(
          !newTenantSettings.isProductionAccessEnabled
        )
      }

      if (newTenantSettings.mfaEnabled != null) {
        updateData.mfaEnabled = String(newTenantSettings.mfaEnabled)
      }

      if (newTenantSettings.passwordResetDays != null) {
        updateData.passwordResetDays = String(
          newTenantSettings.passwordResetDays
        )
      }

      const accountsService = AccountsService.getInstance(this.dynamoDb)

      if (!isEmpty(updateData)) {
        await accountsService.updateAuth0TenantMetadata(
          this.tenantId,
          updateData
        )
      }
    }

    await this.algorithmChangeCapture(
      existingTenantSettings?.riskScoringAlgorithm?.type,
      newTenantSettings.riskScoringAlgorithm?.type
    )

    await this.featureFlagChangeCapture(
      existingTenantSettings?.features ?? [],
      newTenantSettings.features ?? []
    )

    return updatedResult
  }

  public static async getAllTenantIds() {
    const mongoDb = (await getMongoDbClient()).db()
    let allTenantIds = (await mongoDb.listCollections().toArray())
      .filter(
        ({ name }) =>
          !name.startsWith('migration') && name.endsWith('-transactions')
      )
      .map((collection) =>
        collection.name.slice(0, collection.name.lastIndexOf('-'))
      )
    const deletedTenantIds = await mongoDb
      .collection(TENANT_DELETION_COLLECTION)
      .find({})
      .toArray()
    const deletedTenantIdsSet = new Set(
      deletedTenantIds.map((tenant) => tenant.tenantId)
    )
    allTenantIds = allTenantIds.filter(
      (tenantId) => !deletedTenantIdsSet.has(tenantId)
    )
    return uniq(compact(allTenantIds))
  }

  public async getTenantSettings(
    unmaskDowJonesPassword?: boolean
  ): Promise<TenantSettings> {
    // this always contains dowjones password
    const settings = await tenantSettings(this.tenantId)

    return sanitizeTenantSettings(settings, !unmaskDowJonesPassword)
  }

  public async getTenantById(tenantId: string) {
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(tenantId)
    if (!tenant) {
      throw new createHttpError.NotFound('Tenant id not found')
    }
    return tenant
  }

  public async deleteTenant(
    tenantIdToDelete: string,
    notRecoverable?: boolean
  ) {
    if (tenantIdToDelete === this.tenantId) {
      throw new createHttpError.BadRequest(
        'Cannot delete tenant: cannot delete self'
      )
    }

    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(tenantIdToDelete)

    if (
      tenantIdToDelete.toLowerCase().includes('flagright') ||
      tenant?.name.toLowerCase().includes('flagright')
    ) {
      throw new createHttpError.BadRequest(
        'Cannot delete tenant with flagright in the name'
      )
    }

    const tenantRepository = new TenantRepository(tenantIdToDelete, {
      mongoDb: this.mongoDb,
    })

    if (await tenantRepository.isDeletetionRecordExists(tenantIdToDelete)) {
      throw new createHttpError.Forbidden(
        `Tenant deletion record already exists for tenantId: ${tenantIdToDelete}`
      )
    }

    await tenantRepository.createPendingRecordForTenantDeletion({
      tenantId: tenantIdToDelete,
      tenantName: tenant?.name ?? tenantIdToDelete,
      triggeredByEmail: getContext()?.user?.email ?? '',
      triggeredById: getContext()?.user?.id ?? '',
      notRecoverable: notRecoverable ?? false,
    })

    await sendBatchJobCommand({
      type: 'TENANT_DELETION',
      tenantId: tenantIdToDelete,
      parameters: { notRecoverable: notRecoverable ?? false },
    })
  }

  public async getAllTenants(auth0Domain: string) {
    let tenants: Tenant[] = []
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    if (isWhitelabelAuth0Domain(auth0Domain)) {
      tenants = await accountsService.getTenants()
    } else {
      assertCurrentUserRole('root')
      tenants = flatten(
        await Promise.all(
          getAuth0TenantConfigs(process.env.ENV as Stage).map(
            async (config) => {
              const host = new URL(config.consoleUrl).host
              const auth0Domain = getAuth0Domain(
                config.tenantName,
                config.region
              )
              const partialTenants = await accountsService.getTenants(
                auth0Domain
              )
              return partialTenants.map((v) => ({ ...v, host }))
            }
          )
        )
      )
    }
    return tenants
  }

  async getRiskCalculationFormula(): Promise<
    FormulaSimpleAvg | FormulaLegacyMovingAvg | FormulaCustom | undefined
  > {
    const contextRiskCalculationFormula =
      getContext()?.settings?.riskScoringAlgorithm
    if (contextRiskCalculationFormula) {
      return contextRiskCalculationFormula
    }
    const tenantSettings = await this.getTenantSettings()
    return tenantSettings.riskScoringAlgorithm
  }

  public async getTenantsDeletionData() {
    const tenantRepository = new TenantRepository('', {
      mongoDb: this.mongoDb,
    })
    const {
      tenantIdsDeletedRecently,
      tenantIdsFailedToDelete,
      tenantIdsMarkedForDelete,
    } = await tenantRepository.getTenantsDeletionData()

    return {
      tenantsFailedToDelete: tenantIdsFailedToDelete,
      tenantsDeletedRecently: tenantIdsDeletedRecently,
      tenantsMarkedForDelete: tenantIdsMarkedForDelete,
    }
  }

  async getBatchJobBulkRerunRiskScoringStatus() {
    const batchRerunUsersService = new BatchRerunUsersService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    return await batchRerunUsersService.getBatchJobBulkRerunRiskScoringStatus()
  }

  async postBatchJobBulkRerunRiskScoring() {
    const batchRerunUsersService = new BatchRerunUsersService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const toRerun = await batchRerunUsersService.toRerunRiskScoring()

    if (toRerun.isError) {
      throw new createHttpError.BadRequest(toRerun.error)
    }

    await sendBatchJobCommand({
      type: 'BATCH_RERUN_USERS',
      tenantId: this.tenantId,
      parameters: {
        jobType: 'RERUN_RISK_SCORING',
      },
    })
  }

  /**
   * Handles workflow removals by auto-applying pending approvals when workflows are set to undefined
   */
  private async handleWorkflowRemovals(
    oldWorkflowSettings: Record<string, unknown>,
    newWorkflowSettings: Record<string, unknown>
  ): Promise<void> {
    try {
      // Check for removed user approval workflows
      if (
        oldWorkflowSettings?.userApprovalWorkflows &&
        newWorkflowSettings?.userApprovalWorkflows
      ) {
        const removedUserFields: string[] = []

        // Check each user approval workflow field
        for (const [field, oldWorkflowId] of Object.entries(
          oldWorkflowSettings.userApprovalWorkflows
        )) {
          const newWorkflowId = newWorkflowSettings.userApprovalWorkflows[field]

          // If workflow was removed (set to undefined) and previously had a workflow
          if (oldWorkflowId && !newWorkflowId) {
            removedUserFields.push(field)
          }
        }

        if (removedUserFields.length > 0) {
          console.log(
            `Detected removed user workflow fields: ${removedUserFields.join(
              ', '
            )}`
          )
          // TODO: IMPLEMENT THIS!
          // const appliedCount =
          // await workflowService.autoApplyPendingApprovalsForRemovedWorkflows(
          //   'user-update-approval',
          //   removedUserFields
          // )
          // console.log(
          //   `Auto-applied ${appliedCount} pending user approvals for removed workflows`
          // )
        }
      }
    } catch (error) {
      console.error('Error handling workflow removals:', error)
      // Don't throw - we don't want to block tenant settings updates if auto-apply fails
    }
  }

  private async deactivateApiKeys(
    apiKeyIds: { apiKeyId: string; tenantId: string }[]
  ) {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
      maxAttempts: 2,
    })

    const batchWriteRequest: { [key: string]: BatchWriteRequestInternal[] } = {}

    for await (const { apiKeyId, tenantId } of apiKeyIds) {
      await apigateway.send(
        new UpdateApiKeyCommand({
          apiKey: apiKeyId,
          patchOperations: [
            {
              op: 'replace',
              path: '/enabled',
              value: 'false',
            },
          ],
        })
      )
      const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      if (!batchWriteRequest[tableName]) {
        batchWriteRequest[tableName] = []
      }
      batchWriteRequest[tableName].push({
        DeleteRequest: {
          Key: {
            ...DynamoDbKeys.DEACTIVATION_MARKED_API_KEY(tenantId, apiKeyId),
          },
        },
      })
    }

    const keys = Object.keys(batchWriteRequest)

    for await (const tableName of keys) {
      await batchWrite(this.dynamoDb, batchWriteRequest[tableName], tableName)
    }
  }

  private async notifyApiKeysDeactivation(
    apiKeyIds: { apiKeyId: string; tenantId: string }[]
  ) {
    const tasks: AuditLogRecord[] = apiKeyIds.map((apiKeyInfo) => ({
      tenantId: apiKeyInfo.tenantId,
      payload: {
        entityId: apiKeyInfo.apiKeyId,
        type: 'API-KEY',
        action: 'ROTATE',
      },
    }))
    if (envIs('local', 'test')) {
      const { notificationsConsumerHandler } = await import(
        '@/core/local-handlers/auditlog'
      )
      await pMap(
        tasks,
        async (task) => {
          await notificationsConsumerHandler(task)
        },
        { concurrency: 10 }
      )
      return
    }
    const sqsClient = getSQSClient()
    const messages = tasks.map((task) => ({
      MessageBody: JSON.stringify(task),
      MessageDeduplicationId: generateChecksum(task.payload.entityId),
    }))
    await bulkSendMessages(
      sqsClient,
      getSQSQueueUrl(process.env.NOTIFICATIONS_QUEUE_URL as string),
      messages
    )
  }

  @auditLog('API-KEY', 'API_KEY_ROTATE', 'CREATE')
  public async rotateApiKey(apiKeyId: string) {
    const tenantId = getNonDemoTenantId(this.tenantId)
    // check if rotation in progress
    const getCommandInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      Key: {
        ...DynamoDbKeys.DEACTIVATION_MARKED_API_KEY(tenantId, apiKeyId),
      },
    }

    const response = await this.dynamoDb.send(new GetCommand(getCommandInput))

    if (response?.Item?.length > 0) {
      throw new BadRequest('API key already marked for deletion')
    }

    // fetch all api keys
    const apiKeys = await this.getTenantApiKeys()

    // get usage plan
    const usagePlan = await this.getTenantUsagePlanId(tenantId)

    if (!usagePlan.id) {
      throw new Error(`Can't find usage plan id`)
    }

    let toMarkApiKey = false
    let newApiKeyId = ''
    // generate new api keys
    for (let i = 0; i < apiKeys.length; i++) {
      if (apiKeys[i].id !== apiKeyId) {
        continue
      }
      try {
        const { apiKeyId } = await this.generateTenantApiKey(
          tenantId,
          usagePlan.id
        )
        newApiKeyId = apiKeyId
        toMarkApiKey = true
      } catch (error) {
        logger.error(`Error while generating api key ${error}`)
      }
    }

    if (toMarkApiKey) {
      // mark older api key for deletion
      const deactivationTimestamp = dayjs()
        .add(8, 'days')
        .startOf('day')
        .valueOf() // as we deactivate api key in daily cron job we add 7 days and set time to midnight, so the job running at 12:15 will pick this and deactive it
      // we run cron job daily at 12:15 for each region thus this will be picked
      const putItemInput: PutCommandInput = {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        Item: {
          ...DynamoDbKeys.DEACTIVATION_MARKED_API_KEY(tenantId, apiKeyId),
          apiKeyId: apiKeyId,
          tenantId: tenantId,
          deactivationTimestamp,
        },
      }
      await this.dynamoDb.send(new PutCommand(putItemInput))
    }

    return {
      result: undefined,
      entities: [
        { entityId: newApiKeyId, entityAction: 'CREATE' as AuditLogActionEnum },
        { entityId: apiKeyId, entityAction: 'ROTATE' as AuditLogActionEnum },
      ],
      publishAuditLog: () => toMarkApiKey,
    }
  }

  private getDeletionMarkedApiKeyQuery(tenantId: string, timestamp: number) {
    const partitionKey = DynamoDbKeys.DEACTIVATION_MARKED_API_KEY(
      tenantId,
      ''
    ).PartitionKeyID
    const getItemQuery: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: '#ts < :now',
      ExpressionAttributeNames: {
        '#ts': 'deactivationTimestamp',
      },
      ExpressionAttributeValues: {
        ':pk': partitionKey,
        ':now': timestamp,
      },
    }

    return getItemQuery
  }

  @auditLog('API-KEY', 'API_KEY_ROTATE', 'DEACTIVATE')
  public async deactivateApiKeyMarkedForDeletion(tenantInfos: TenantInfo[]) {
    const [stage, region] = stageAndRegion()

    // api keys about to expire in 2 days
    const currentTimestamp = dayjs().utc().valueOf()
    const filterTimestamp = dayjs().utc().add(2, 'days').valueOf()

    // non silo tenants
    const getItemQuery = this.getDeletionMarkedApiKeyQuery(
      FLAGRIGHT_TENANT_ID,
      filterTimestamp
    )
    const response = await this.dynamoDb.send(new QueryCommand(getItemQuery))

    const apiKeysToNotify: { apiKeyId: string; tenantId: string }[] =
      response.Items?.filter((data) => {
        return data?.deactivationTimestamp >= currentTimestamp
      }).map((data) => ({
        apiKeyId: data?.apiKeyId as string,
        tenantId: data?.tenantId as string,
      })) ?? []

    const apiKeysToDelete: { apiKeyId: string; tenantId: string }[] =
      response.Items?.filter((data) => {
        return data?.deactivationTimestamp < currentTimestamp
      }).map((data) => ({
        apiKeyId: data?.apiKeyId as string,
        tenantId: data?.tenantId as string,
      })) ?? []

    // silo tenant api keys
    for await (const tenant of tenantInfos) {
      const tenantId = tenant.tenant.id
      if (siloDataTenants[stage]?.[region]?.includes(tenantId)) {
        const getItemQuery = this.getDeletionMarkedApiKeyQuery(
          tenantId,
          filterTimestamp
        )
        const response = await this.dynamoDb.send(
          new QueryCommand(getItemQuery)
        )

        const siloTenantapiKeysToNotify: {
          apiKeyId: string
          tenantId: string
        }[] =
          response.Items?.filter((data) => {
            return data?.deactivationTimestamp >= filterTimestamp
          }).map((data) => ({
            apiKeyId: data?.apiKeyId as string,
            tenantId: data?.tenantId as string,
          })) ?? []

        const siloTenantApiKeyToDelete: {
          apiKeyId: string
          tenantId: string
        }[] =
          response.Items?.map((data) => ({
            apiKeyId: data?.apiKeyId as string,
            tenantId: data?.tenantId as string,
          })) ?? []

        apiKeysToDelete.push(...siloTenantApiKeyToDelete)
        apiKeysToNotify.push(...siloTenantapiKeysToNotify)
      }
    }
    await this.deactivateApiKeys(apiKeysToDelete)
    await this.notifyApiKeysDeactivation(apiKeysToNotify)

    return {
      result: undefined,
      entities: apiKeysToDelete.map((apiKeyInfo) => ({
        entityId: apiKeyInfo.apiKeyId,
        tenantId: apiKeyInfo.tenantId,
      })),
      publishAuditLog: () => false,
    }
  }
}
