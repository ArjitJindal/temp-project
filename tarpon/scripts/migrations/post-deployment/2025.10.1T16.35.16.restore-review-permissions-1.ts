import { stageAndRegion } from '@flagright/lib/utils'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { isValidManagedRoleName } from '@/@types/openapi-internal-custom/ManagedRoleName'
import { AccountsService } from '@/services/accounts'
import { logger } from '@/core/logger'
import { isDemoTenant } from '@/utils/tenant-id'
import { Tenant } from '@/@types/tenant'
import { AUDITLOG_COLLECTION } from '@/utils/mongo-table-names'

const timestamps = {
  prod: { $gte: 1759050000000, $lte: 1759053600000 }, // timestamp when the migration ran on prod
}

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const [stage] = stageAndRegion()
  if (!timestamps[stage] || isDemoTenant(tenant.id)) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const accountService = new AccountsService({ auth0Domain }, { dynamoDb })

  const auditLogs = await db
    .collection<AuditLog>(AUDITLOG_COLLECTION(tenant.id))
    .find({
      timestamp: timestamps[stage],
      action: 'UPDATE',
      type: 'ACCOUNT',
      'user.id': 'Flagright System',
    })
    .sort({ timestamp: 1 })
    .toArray()

  logger.info(`Found ${auditLogs.length} audit logs`)

  const fieldsToPopulate = [
    'escalationLevel',
    'escalationReviewerId',
    'reviewerId',
    'isReviewer',
  ]

  for (const log of auditLogs) {
    const oldRole = log.oldImage.role
    // will only migrate custom role
    if (!isValidManagedRoleName(oldRole)) {
      const hasFields = fieldsToPopulate.some(
        (field) => log.oldImage[`${field}`]
      )
      if (hasFields && log.oldImage.id) {
        logger.info(`Restoring ${log.oldImage.id} `)
        const updates = {
          escalationLevel: log.oldImage.escalationLevel,
          escalationReviewerId: log.oldImage.escalationReviewerId,
          reviewerId: log.oldImage.reviewerId,
          isReviewer: log.oldImage.isReviewer,
        }
        logger.info(updates)
        await accountService.patchUser(tenant, log.oldImage.id, updates)
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
