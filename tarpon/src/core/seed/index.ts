import { isEmpty, isEqual, uniq } from 'lodash'
import { logger } from '../logger'
import { TenantSettingName } from '../dynamodb/dynamodb-keys'
import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { seedClickhouse } from './clickhouse'
import { removeDemoRoles } from './roles-setup'
import { getReports } from './data/reports'
import { deleteXMLFileFromS3 } from './samplers/report'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'
import { envIsNot } from '@/utils/env'
import { getUsers } from '@/core/seed/data/users'
import { isDemoTenant } from '@/utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Feature } from '@/@types/openapi-internal/Feature'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const account = await fetchAndSetAccounts(tenantId, dynamo)
  await removeDemoRoles(tenantId, account, dynamo)
  await createTenantDatabase(tenantId)
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
      'AI_FORENSICS' as Feature,
      'MACHINE_LEARNING' as Feature,
      'SCREENING' as Feature,
      'ACURIS' as Feature,
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
  await getUsers(tenantId)
  if (envIsNot('local')) {
    await deleteXMLFileFromS3(tenantId)
  }
  await getReports(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(tenantId, mongoDb, dynamo)
  await seedClickhouse(tenantId)
}
