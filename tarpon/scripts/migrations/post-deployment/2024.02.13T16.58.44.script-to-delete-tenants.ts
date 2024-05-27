import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { envIs } from '@/utils/env'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const up = async () => {
  if (!envIs('prod')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const regionAndTenants: Partial<Record<FlagrightRegion, string[]>> = {
    'asia-2': ['GDQ5E7M9CE'],
    'eu-1': ['COZWWKQO2B', 'P80MYPEJ2Z'],
    'us-1': ['CAWJQOEX73'],
    'asia-1': ['CRSUPS3XAY'],
  }

  for (const [region, tenantIds] of Object.entries(regionAndTenants)) {
    if ((process.env.ENV as string).includes(region)) {
      for (const tenantId of tenantIds) {
        const tenantRepository = new TenantRepository(tenantId, {
          mongoDb,
        })

        await tenantRepository.createPendingRecordForTenantDeletion({
          notRecoverable: true,
          tenantId,
          triggeredByEmail: 'system',
          triggeredById: 'system',
        })

        await sendBatchJobCommand({
          type: 'TENANT_DELETION',
          tenantId,
          parameters: { notRecoverable: true },
        })
      }
    }
  }
}
