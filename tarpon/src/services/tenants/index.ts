import { MongoClient } from 'mongodb'
import { compact, map } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayClient,
  ApiStage,
  CreateUsagePlanCommand,
  GetRestApisCommand,
  GetUsagePlanKeysCommand,
  GetUsagePlansCommand,
  ThrottleSettings,
  UsagePlan,
  GetUsageCommand,
  GetApiKeyCommand,
  ApiKey,
} from '@aws-sdk/client-api-gateway'
import { StackConstants } from '@lib/constants'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { BadRequest } from 'http-errors'
import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { createNewApiKeyForTenant } from '../api-key'
import { sendBatchJobCommand } from '../batch-job'
import { TenantRepository } from './repositories/tenant-repository'
import { TenantCreationResponse } from '@/@types/openapi-internal/TenantCreationResponse'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountsService, Tenant, TenantBasic } from '@/services/accounts'
import { checkMultipleEmails } from '@/utils/helpers'
import { getAuth0Domain } from '@/utils/auth0-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { TenantUsageData } from '@/@types/openapi-internal/TenantUsageData'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { TenantApiKey } from '@/@types/openapi-internal/TenantApiKey'
import { isFlagrightInternalUser } from '@/@types/jwt'

export type TenantInfo = {
  tenant: Tenant
  auth0Domain: string
  auth0TenantConfig: Auth0TenantConfig
}

export const USAGE_PLAN_REGEX = /tarpon:(.*):(.*)/

@traceable
export class TenantService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb
    this.tenantId = tenantId
  }

  public static getAllTenants = async (
    stage?: Stage,
    region?: FlagrightRegion
  ): Promise<TenantInfo[]> => {
    const stageOrDefault = stage ?? (process.env.ENV as Stage)
    const regionOrDefault = region ?? process.env.REGION
    const tenantInfos: Array<TenantInfo> = []
    const mongoDb = await getMongoDbClient()
    const auth0TenantConfigs = getAuth0TenantConfigs(stageOrDefault, region)
    for (const auth0TenantConfig of auth0TenantConfigs) {
      const auth0Domain = getAuth0Domain(
        auth0TenantConfig.tenantName,
        auth0TenantConfig.region
      )
      const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
      tenantInfos.push(
        ...(await accountsService.getTenants()).map((tenant) => ({
          tenant,
          auth0Domain,
          auth0TenantConfig,
        }))
      )
    }

    return region
      ? tenantInfos.filter(
          (tenantInfo) =>
            !tenantInfo.tenant.region ||
            tenantInfo.tenant.region === regionOrDefault
        )
      : tenantInfos
  }

  async createTenant(
    tenantData: TenantCreationRequest
  ): Promise<TenantCreationResponse> {
    if (!tenantData.tenantName || !tenantData.tenantWebsite) {
      throw new BadRequest('Tenant name, website and website are required')
    }

    const accountsService = new AccountsService(
      { auth0Domain: tenantData.auth0Domain },
      { mongoDb: this.mongoDb }
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

    await this.assertUsagePlanNotExist(tenantData.tenantName)

    const tenantId = this.tenantId

    const usagePlanId = await this.createUsagePlan(tenantData, tenantId)

    if (usagePlanId == null) {
      throw new Error('Unable to create usage plan')
    }

    const apiKey = await createNewApiKeyForTenant(tenantId, usagePlanId)

    if (!apiKey) {
      throw new Error('Unable to create api key')
    }

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

    const newTenantSettings: TenantSettings = {
      limits: { seats: tenantData.seats ?? 5, apiKeyView: 2 },
      features: tenantData.features ?? [],
    }
    const dynamoDb = this.dynamoDb
    const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
    await tenantRepository.createOrUpdateTenantSettings(newTenantSettings)

    await sendBatchJobCommand({
      type: 'SYNC_INDEXES',
      tenantId,
    })

    return {
      tenantId,
      tenantName: tenantData.tenantName,
      usagePlanId,
      ...(organization.id && { auth0OrganizationId: organization.id }),
    }
  }

  static async getTenantInfoFromUsagePlans(): Promise<TenantBasic[]> {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
      maxAttempts: 10,
    })

    const allUsagePlans = await TenantService.getAllUsagePlans()

    const usagePlanKeys = compact(
      await Promise.all(
        await allUsagePlans.map(async (usagePlan) => {
          const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
            usagePlanId: usagePlan.id,
          })

          const usagePlanKeys = await apigateway.send(usagePlanKeysCommand)

          if (usagePlanKeys.items?.length) {
            return {
              ...usagePlan,
              tenantId: usagePlanKeys.items[0].name,
            }
          } else {
            logger.warn(
              `Usage plan ${usagePlan.id} does not have any keys associated with it`
            )
            return null
          }
        })
      )
    )

    const tenantDetails = compact(
      map(usagePlanKeys, (usagePlan) => {
        if (
          usagePlan.name &&
          USAGE_PLAN_REGEX.test(usagePlan.name) &&
          usagePlan.tenantId &&
          usagePlan.name?.includes(usagePlan.tenantId)
        ) {
          return {
            id: usagePlan.tenantId,
            name: usagePlan.name
              .replace('tarpon:', '')
              .replace(':', '')
              .replace(usagePlan.tenantId, ''),
          }
        }
        logger.warn(
          `Invalid usage plan name ${usagePlan.name} for usage plan ${usagePlan.id}`
        )
        return null
      })
    )

    return tenantDetails
  }

  static async getAllUsagePlans(): Promise<UsagePlan[]> {
    const apigateway = new APIGatewayClient({
      region: envIs('local') ? 'eu-central-1' : process.env.AWS_REGION,
    })
    // TODO: handle for more than 500 usage plans
    const usagePlansCommand = new GetUsagePlansCommand({
      limit: 500,
    })

    const usagePlans = await apigateway.send(usagePlansCommand)

    if (!usagePlans?.items?.length) {
      logger.error('No usage plans found')
      return []
    }

    return usagePlans.items
  }

  async assertUsagePlanNotExist(planName: string): Promise<void> {
    const usagePlans = await TenantService.getAllUsagePlans()

    const usagePlan = usagePlans?.find((x) => x.name?.includes(`${planName}`))
    const usagePlanName = usagePlan?.name

    if (usagePlanName == null) {
      return
    }

    if (usagePlanName.match(USAGE_PLAN_REGEX)?.[2] === planName) {
      throw new BadRequest(`Usage plan for tenant ${planName} already exists`)
    }
  }

  async getApiStages(): Promise<ApiStage[] | undefined> {
    const apigateway = new APIGatewayClient({
      region: envIs('local') ? 'eu-central-1' : process.env.AWS_REGION,
    })

    const apiGatewayCommand = new GetRestApisCommand({})

    const apiGatewaysFiltered = await apigateway.send(apiGatewayCommand)
    if (!apiGatewaysFiltered?.items?.length) {
      return undefined
    }

    return apiGatewaysFiltered.items
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

  public async getApiKeys(unmaskingOptions?: {
    unmask: boolean
    apiKeyId: string
  }): Promise<TenantApiKey[]> {
    const allUsagePlans = await TenantService.getAllUsagePlans()

    const tenantId = this.tenantId.endsWith('-test')
      ? this.tenantId.replace('-test', '')
      : this.tenantId

    const usagePlan = allUsagePlans?.find(
      (x) => x.name?.match(USAGE_PLAN_REGEX)?.[1] === tenantId
    )

    if (!usagePlan) {
      throw new Error(`Usage plan for tenant ${tenantId} not found`)
    }

    const apigateway = new APIGatewayClient({
      region: envIs('local') ? 'eu-central-1' : process.env.AWS_REGION,
    })

    const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
      usagePlanId: usagePlan.id,
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

    const apiKeys: TenantApiKey[] = allApiKeys.map((x) => ({
      id: x.id ?? '',
      createdAt: dayjs(x.createdDate).valueOf(),
      key: x.value ?? '',
      updatedAt: dayjs(x.lastUpdatedDate).valueOf(),
    }))

    if (unmaskingOptions?.apiKeyId && unmaskingOptions.unmask) {
      const apiKeysProcessed = await this.processApiKeys(
        allApiKeys,
        unmaskingOptions
      )

      return apiKeysProcessed
    }

    return apiKeys.map((x) => ({
      id: x.id,
      createdAt: x.createdAt,
      key: x.key?.replace(/.(?=.{4})/g, '*'),
      updatedAt: x.updatedAt,
    }))
  }

  private async processApiKeys(
    apiKeys: ApiKey[],
    unmaskingOptions: {
      unmask: boolean
      apiKeyId: string
    }
  ): Promise<TenantApiKey[]> {
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const tenantSettings = await tenantRepository.getTenantSettings()

    const apiKeyViewTimes =
      tenantSettings?.apiKeyViewData?.find(
        (x) => x.apiKey === unmaskingOptions.apiKeyId
      )?.count ?? 0

    const apiKeysProcessed = apiKeys.map((x) => {
      let value = x.value

      if (
        unmaskingOptions.unmask &&
        apiKeyViewTimes >= (tenantSettings?.limits?.apiKeyView ?? 2)
      ) {
        value = x.value?.replace(/.(?=.{4})/g, '*')
      }

      return {
        id: x.id ?? '',
        createdAt: dayjs(x.createdDate).valueOf(),
        key: value ?? '',
        updatedAt: dayjs(x.lastUpdatedDate).valueOf(),
      }
    })

    const apiKeyViewData = tenantSettings?.apiKeyViewData ?? []

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

  public async getUsagePlanData(tenantId: string): Promise<TenantUsageData> {
    const usagePlans = await TenantService.getAllUsagePlans()

    if (tenantId.endsWith('-test')) {
      tenantId = tenantId.replace('-test', '')
    }
    const usagePlan = usagePlans?.find(
      (x) => x.name?.match(USAGE_PLAN_REGEX)?.[1] === tenantId
    )

    if (!usagePlan) {
      throw new Error(`Usage plan for tenant ${tenantId} not found`)
    }

    const apigateway = new APIGatewayClient({
      region: envIs('local') ? 'eu-central-1' : process.env.AWS_REGION,
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
      burstCapacity: usagePlan.throttle?.burstLimit ?? 0,
      rateLimit: usagePlan.throttle?.rateLimit ?? 0,
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
      throttleSettings = { burstLimit: 200, rateLimit: 100 }
    } else {
      throttleSettings = { burstLimit: 6, rateLimit: 3 }
    }

    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
    })

    const createdUsgaePlanCommand = new CreateUsagePlanCommand({
      name: this.getUsagePlanName(tenantId, tenantData.tenantName),
      throttle: throttleSettings,
      apiStages: await this.getApiStages(),
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
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const updatedResult = await tenantRepository.createOrUpdateTenantSettings(
      newTenantSettings
    )
    if (newTenantSettings.isProductionAccessEnabled != null) {
      const accountsService = new AccountsService(
        { auth0Domain: process.env.AUTH0_DOMAIN as string },
        { mongoDb: this.mongoDb }
      )

      await accountsService.updateProductionAccessForTenant(
        this.tenantId,
        !newTenantSettings.isProductionAccessEnabled
      )
    }

    return updatedResult
  }
}
