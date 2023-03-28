import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayClient,
  CreateUsagePlanCommand,
  GetRestApisCommand,
  GetUsagePlansCommand,
} from '@aws-sdk/client-api-gateway'
import { BadRequest } from 'http-errors'
import { StackConstants } from '@cdk/constants'
import { getAuth0TenantConfigs } from '@cdk/auth0/tenant-config'
import { TenantCreationResponse } from '@/@types/openapi-internal/TenantCreationResponse'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountsService, Tenant } from '@/services/accounts'
import { createNewApiKeyForTenant } from '@/services/api-key'
import { checkMultipleEmails } from '@/utils/helpers'
import { getAuth0Domain } from '@/utils/auth0-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export type TenantInfo = {
  tenant: Tenant
  auth0Domain: string
}

export class TenantService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public static getAllTenants = async (): Promise<Array<TenantInfo>> => {
    const tenantInfos: Array<TenantInfo> = []
    const mongoDb = await getMongoDbClient()
    const auth0TenantConfigs = getAuth0TenantConfigs(
      process.env.ENV as 'local' | 'dev' | 'sandbox' | 'prod'
    )
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
        }))
      )
    }
    return tenantInfos
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

    await this.checkUsagePlanExists(tenantData.tenantName)

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

    return {
      tenantId,
      tenantName: tenantData.tenantName,
      apiKey,
      usagePlanId,
      ...(organization.id && { auth0OrganizationId: organization.id }),
    }
  }

  async checkUsagePlanExists(planName: string): Promise<void> {
    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
    })

    const usagePlansCommand = new GetUsagePlansCommand({})

    const usagePlans = await apigateway.send(usagePlansCommand)

    const usagePlan = usagePlans.items?.find((x) =>
      x.name?.includes(`${planName}`)
    )

    const usagePlanName = usagePlan?.name

    if (usagePlanName == null) {
      return
    }

    if (usagePlanName.match(/tarpon:(.*):(.*)/)?.[2] === planName) {
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
        quota: { limit: 1000, offset: 0, period: 'MONTH' },
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
