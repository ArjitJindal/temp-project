import { migrateAllTenants } from '../utils/tenant'
import { migrateTenant } from '../pre-deployment/2022.09.15T07.18.27.transaction-case-entity'

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skipping
}
