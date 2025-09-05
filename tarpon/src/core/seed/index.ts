import { isEmpty, isEqual, uniq } from 'lodash'
import { logger } from '../logger'
import { TenantSettingName } from '../dynamodb/dynamodb-keys'
import { seedDynamo } from './dynamodb'
import { fetchAndSetAccounts } from './account-setup'
import { removeDemoRoles } from './roles-setup'
import { getReports } from './data/reports'
import { deleteXMLFileFromS3 } from './samplers/report'
import { seedMongo } from './mongo'
import { seedClickhouse } from './clickhouse'
import { getCounterCollectionData } from './data/counter'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'
import { envIsNot } from '@/utils/env'
import { getUsers } from '@/core/seed/data/users'
import { isDemoTenant } from '@/utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  let now = Date.now()

  // setting tenant id
  process.env.TENANT_ID = tenantId

  const account = await fetchAndSetAccounts(tenantId, dynamo)
  await removeDemoRoles(tenantId, account, dynamo)
  now = Date.now()
  await createTenantDatabase(tenantId)
  logger.info(`TIME: Tenant database creation took ~ ${Date.now() - now}`)
  // feature flag creation before any other operation
  if (isDemoTenant(tenantId)) {
    const nonDemoTenantId = tenantId.replace(/-test$/, '')

    const tenantRepo = new TenantRepository(tenantId, { dynamoDb: dynamo })
    const nonDemoTenantRepo = new TenantRepository(nonDemoTenantId, {
      dynamoDb: dynamo,
    })
    const nonDemoSettings = await nonDemoTenantRepo.getTenantSettings()
    const demoSettings = await tenantRepo.getTenantSettings()
    const mergedFeatureFlags = uniq([
      ...(demoSettings.features ?? []),
      ...(nonDemoSettings.features ?? []),
    ])
    const getTenantSettingsKeysToDelete = (): TenantSettingName[] => {
      const keys = TenantSettings.attributeTypeMap
        .map((key) => key.name)
        .filter((key) => key !== 'features')
      return keys as TenantSettingName[]
    }
    if (!isEmpty(nonDemoSettings) && !isEqual(demoSettings, nonDemoSettings)) {
      logger.info('Setting tenant settings...')
      await tenantRepo.deleteTenantSettings(getTenantSettingsKeysToDelete())
      await tenantRepo.createOrUpdateTenantSettings({
        ...nonDemoSettings,
        isAiEnabled: true,
        isMlEnabled: true,
        features: mergedFeatureFlags,
      })
    }
  }
  // necessary to get the users first before seeding the rest
  logger.info('Creating mock users...')
  now = Date.now()
  await getUsers(tenantId)
  logger.info(`TIME: Users creation took ~ ${Date.now() - now}`)

  // will generate most of the data
  now = Date.now()
  getCounterCollectionData(tenantId)
  logger.info(
    `TIME: Counter collection data creation took ~ ${Date.now() - now}`
  )

  if (envIsNot('local')) {
    now = Date.now()
    await deleteXMLFileFromS3(tenantId)
    logger.info(`TIME: XML file deletion took ~ ${Date.now() - now}`)
  }
  now = Date.now()
  await getReports(tenantId)
  logger.info(`TIME: Reports creation took ~ ${Date.now() - now}`)

  now = Date.now()
  await seedDynamo(dynamo, tenantId)
  logger.info(`TIME: DynamoDB seeding took ~ ${Date.now() - now}`)
  now = Date.now()
  await seedMongo(tenantId, mongoDb, dynamo)
  logger.info(`TIME: MongoDB seeding took ~ ${Date.now() - now}`)
  now = Date.now()
  await seedClickhouse(tenantId)
  logger.info(`TIME: Clickhouse seeding took ~ ${Date.now() - now}`)
}
