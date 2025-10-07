import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/@types/tenant'

async function migrateTenant(tenant: Tenant) {
  console.log(`Starting transactions_desc backfill for tenant: ${tenant.id}`)

  await sendBatchJobCommand({
    tenantId: tenant.id,
    type: 'BACKFILL_TRANSACTIONS_DESC',
    parameters: {
      batchSize: 10000, // 10k documents per batch
    },
  })

  console.log(`Transactions_desc backfill job queued for tenant: ${tenant.id}`)
}

export const up = async () => {
  console.log('Starting transactions_desc backfill for all tenants')
  await migrateAllTenants(migrateTenant)
  console.log('Transactions_desc backfill jobs queued for all tenants')
}

export const down = async () => {
  // No rollback needed - this is a data backfill
  console.log('No rollback needed for data backfill')
}
