import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const db = await getMongoDbClientDb()
  const collection = db.collection<AuditLog>(AUDITLOG_COLLECTION(tenant.id))
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  const auditLogs = await collection
    .find({
      entityId: { $in: ruleInstances.map((ruleInstance) => ruleInstance.id) },
      action: 'CREATE',
    })
    .toArray()
  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.createdBy == null) {
      const auditLog = auditLogs.find(
        (auditLog) => auditLog.entityId === ruleInstance.id
      )
      if (auditLog) {
        await ruleInstanceRepository.createOrUpdateRuleInstance(
          { ...ruleInstance, createdBy: auditLog.user?.id },
          ruleInstance.updatedAt
        )
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
