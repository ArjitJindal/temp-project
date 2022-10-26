import { migrateTenant } from '../pre-deployment/2022.10.20T19.31.06.kill-thin-transaction'
import { migrateAllTenants } from '../utils/tenant'

export const up = async () => {
  // We don't backfill non-prod envs
  if (process.env.ENV?.startsWith('prod')) {
    await migrateAllTenants((tenant) =>
      migrateTenant(
        tenant,
        new Date('2022-10-26').valueOf(),
        Number.MAX_SAFE_INTEGER
      )
    )
  }
}

export const down = async () => {
  // skip
}
