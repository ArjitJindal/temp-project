import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, { dynamoDb })
  const { features } = await tenantRepository.getTenantSettings(['features'])
  if (features?.includes('RISK_SCORING')) {
    await sendBatchJobCommand({
      tenantId: tenant.id,
      type: 'FIX_LOCKS_FOR_KRS',
    })
    logger.info(`Start KRS lock fix job for ${tenant.id} `)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
