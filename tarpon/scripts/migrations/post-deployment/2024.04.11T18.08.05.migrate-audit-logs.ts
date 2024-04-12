import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

async function migrateTenant(tenant: Tenant) {
  const isRiskLevelsEnabled = await tenantHasFeature(tenant.id, 'RISK_LEVELS')
  if (!isRiskLevelsEnabled) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const fieldsToRemove: (keyof RuleInstance)[] = [
    'parameters',
    'action',
    'triggersOnHit',
    'logic',
  ]

  const auditLogsCollectionName = AUDITLOG_COLLECTION(tenant.id)
  const auditLogsCollection = db.collection<AuditLog>(auditLogsCollectionName)

  await auditLogsCollection.updateMany(
    { type: 'RULE' },
    {
      $unset: fieldsToRemove.reduce((acc, field) => {
        const key1 = `oldImage.${field}`
        const key2 = `newImage.${field}`

        acc[key1] = ''
        acc[key2] = ''
        return acc
      }, {} as Record<string, string>),
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
