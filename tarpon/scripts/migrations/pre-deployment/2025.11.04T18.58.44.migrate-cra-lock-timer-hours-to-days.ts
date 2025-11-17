import { migrateAllTenants } from '../utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

/**
 * Migration: Convert craLockTimerHours to craLockTimerDays
 *
 * This migration converts the old `craLockTimerHours` field to the new `craLockTimerDays` field.
 * The conversion is simple: days = hours / 24
 *
 * If a tenant has craLockTimerHours set:
 * - Convert to days (rounded to nearest integer)
 * - Set craLockTimerDays
 * - Remove craLockTimerHours
 *
 * If craLockTimerHours is not set, no action is taken.
 */
async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  // Get current settings - need to cast to any to access the old field
  const settings = (await tenantRepository.getTenantSettings([
    'craLockTimerHours' as any,
    'craLockTimerDays',
  ])) as any

  // Check if old field exists and new field doesn't
  if (
    settings.craLockTimerHours !== undefined &&
    settings.craLockTimerDays === undefined
  ) {
    const hoursValue = settings.craLockTimerHours
    const daysValue = Math.round(hoursValue / 24)

    console.log(
      `Migrating tenant ${tenant.id}: craLockTimerHours=${hoursValue} -> craLockTimerDays=${daysValue}`
    )

    // Update with new field
    await tenantRepository.createOrUpdateTenantSettings({
      craLockTimerDays: daysValue,
    })

    // Remove old field
    await tenantRepository.deleteTenantSettings(['craLockTimerHours' as any])

    console.log(`Successfully migrated tenant ${tenant.id}`)
  } else if (settings.craLockTimerDays !== undefined) {
    console.log(
      `Tenant ${tenant.id} already has craLockTimerDays set (${settings.craLockTimerDays}), skipping`
    )
  } else {
    console.log(`Tenant ${tenant.id} has no craLockTimerHours set, skipping`)
  }
}

export const up = async () => {
  console.log('Starting migration: craLockTimerHours -> craLockTimerDays')
  await migrateAllTenants(migrateTenant)
  console.log('Migration completed')
}

export const down = async () => {
  // No rollback - the old field will simply be ignored by the application
  console.log(
    'Rollback not implemented - old field will be ignored by application'
  )
}
