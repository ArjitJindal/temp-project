import { Db } from 'mongodb'
import { stageAndRegion } from '@flagright/lib/utils'
import { Stage, FlagrightRegion } from '@flagright/lib/constants/deploy'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { getAuth0Domain, isWhitelabelAuth0Domain } from './auth0-utils'
import { TENANT_DELETION_COLLECTION } from './mongo-table-names'
import { getDynamoDbClient } from './dynamodb'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export type Tenant = {
  id: string
  name: string
  orgId: string
  apiAudience: string
  region: string
  isProductionAccessDisabled: boolean
  tenantCreatedAt: string
  consoleApiUrl: string
  auth0Domain: string
}

export type IntercommUser = {
  user_id: string
  name?: string
  email?: string
  company: {
    id: string
    name?: string
    created_at?: string
  }
  Role?: string
}

export const isWhitelabeledTenantFromSettings = (
  settings: Pick<TenantSettings, 'auth0Domain'>
): boolean => {
  return !!settings.auth0Domain && isWhitelabelAuth0Domain(settings.auth0Domain)
}

export const getDeletedTenantIdsSet = async (db: Db): Promise<Set<string>> => {
  const deletedTenantIds = await db
    .collection(TENANT_DELETION_COLLECTION)
    .find({})
    .toArray()
  const deletedTenantIdsSet = new Set<string>()
  deletedTenantIds.forEach((tenant) => {
    const tenantId = tenant.tenantId
    deletedTenantIdsSet.add(tenantId)
    deletedTenantIdsSet.add(`${tenantId}-test`)
  })
  return deletedTenantIdsSet
}

export const getAllTenantIds = async (): Promise<Set<string>> => {
  const [stage, region] = stageAndRegion()
  const dynamoDb = getDynamoDbClient()
  const auth0TenantConfigs = getAuth0TenantConfigs(
    stage as Stage,
    region as FlagrightRegion
  )
  const tenantInfos: Pick<Tenant, 'id' | 'region'>[] = []

  for (const auth0TenantConfig of auth0TenantConfigs) {
    const auth0Domain = getAuth0Domain(
      auth0TenantConfig.tenantName,
      auth0TenantConfig.region
    )
    const query = new QueryCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.ORGANIZATION(auth0Domain, FLAGRIGHT_TENANT_ID)
          .PartitionKeyID,
      },
      ExpressionAttributeNames: {
        '#region': 'region',
      },
      ProjectionExpression: 'id,#region',
    })

    const result = await dynamoDb.send(query)
    const tenants = (result.Items ?? []) as Pick<Tenant, 'id' | 'region'>[]
    tenantInfos.push(...tenants)
  }

  const filteredTenantInfos = region
    ? tenantInfos.filter((tenant) => !tenant.region || tenant.region === region)
    : tenantInfos

  return new Set(filteredTenantInfos.map((tenant) => tenant.id))
}
