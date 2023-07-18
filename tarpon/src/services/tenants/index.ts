import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayClient,
  CreateUsagePlanCommand,
  GetRestApisCommand,
  GetUsagePlanKeysCommand,
  GetUsagePlansCommand,
} from '@aws-sdk/client-api-gateway'
import { StackConstants } from '@lib/constants'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { BadRequest } from 'http-errors'
import { Auth0TenantConfig } from '@lib/configs/auth0/type'
import { TenantRepository } from './repositories/tenant-repository'
import { TenantCreationResponse } from '@/@types/openapi-internal/TenantCreationResponse'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountsService, Tenant, TenantBasic } from '@/services/accounts'
import { createNewApiKeyForTenant } from '@/services/api-key'
import { checkMultipleEmails } from '@/utils/helpers'
import { getAuth0Domain } from '@/utils/auth0-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

export type TenantInfo = {
  tenant: Tenant
  auth0Domain: string
  auth0TenantConfig: Auth0TenantConfig
}

export const USAGE_PLAN_REGEX = /tarpon:(.*):(.*)/

type Stage = 'local' | 'dev' | 'sandbox' | 'prod'

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
    region?: 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2' | 'au-1'
  ): Promise<TenantInfo[]> => {
    const stageOrDefault = stage ?? (process.env.ENV as Stage)
    const regionOrDefault = region ?? process.env.REGION
    const tenantInfos: Array<TenantInfo> = []
    const mongoDb = await getMongoDbClient()
    const auth0TenantConfigs = getAuth0TenantConfigs(stageOrDefault)
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
      limits: {
        seats: tenantData.seats ?? 3,
      },
      features: tenantData.features ?? [],
    }
    const dynamoDb = this.dynamoDb
    const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
    await tenantRepository.createOrUpdateTenantSettings(newTenantSettings)

    return {
      tenantId,
      tenantName: tenantData.tenantName,
      apiKey,
      usagePlanId,
      ...(organization.id && { auth0OrganizationId: organization.id }),
    }
  }

  static async getTenantInfoFromUsagePlans(): Promise<TenantBasic[]> {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
    })

    const allUsagePlans = await TenantService.getAllUsagePlans()

    const usagePlanKeys = _.compact(
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

    const tenantDetails = _.compact(
      _.map(usagePlanKeys, (usagePlan) => {
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
        } else {
          logger.error(
            `Invalid usage plan name ${usagePlan.name} for usage plan ${usagePlan.id}`
          )
        }
        return null
      })
    )

    return tenantDetails
  }

  static async getAllUsagePlans(): Promise<AWS.APIGateway.UsagePlan[]> {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
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

  async getApiStages(): Promise<AWS.APIGateway.ApiStage[] | undefined> {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
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

  async createUsagePlan(
    tenantData: TenantCreationRequest,
    tenantId: string
  ): Promise<string> {
    let throttleSettings: AWS.APIGateway.ThrottleSettings

    if (process.env.ENV?.startsWith('prod')) {
      throttleSettings = { burstLimit: 200, rateLimit: 100 }
    } else {
      throttleSettings = { burstLimit: 6, rateLimit: 3 }
    }

    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
    })

    const createdUsgaePlanCommand = new CreateUsagePlanCommand({
      name: `tarpon:${tenantId}:${tenantData.tenantName}`,
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
}
