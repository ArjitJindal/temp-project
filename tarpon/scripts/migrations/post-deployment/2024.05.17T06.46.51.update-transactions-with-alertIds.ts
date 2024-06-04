import { migrateAllTenants } from '../utils/tenant'
import { updateCaseTransactions } from '../pre-deployment/2024.05.27T09.35.46.update-transactions-with-alertIds'
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
