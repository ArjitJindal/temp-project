import { updateCaseTransactions } from '../pre-deployment/2024.06.05T08.45.24.update-transaction-with-alertIds'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  await updateCaseTransactions(tenant.id, true)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
