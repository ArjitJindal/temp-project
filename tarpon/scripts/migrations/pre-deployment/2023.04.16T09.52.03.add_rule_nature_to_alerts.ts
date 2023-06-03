import { MigrationFn } from 'umzug'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const mongo = await getMongoDbClient()
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)

  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb: dynamoDb,
  })

  const casesCollections = mongo
    .db()
    .collection<Case>(CASES_COLLECTION(tenant.id))

  const cases = await casesCollections.find<Case>({
    alerts: { $exists: true, $ne: [] },
  })

  let migratedCaseCount = 0
  for await (const caseItem of cases) {
    const newAlerts = await Promise.all(
      (caseItem.alerts ?? []).map(async (alert: Alert) => {
        const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
          alert.ruleInstanceId
        )
        if (ruleInstance == null) {
          return alert
        }
        return {
          ...alert,
          ruleNature: ruleInstance.nature,
        }
      })
    )
    await casesCollections.updateOne(caseItem, {
      $set: {
        alerts: newAlerts,
      },
    })
    migratedCaseCount++
  }

  console.info(`Migrated ${migratedCaseCount} cases`)
}

export const up: MigrationFn = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down: MigrationFn = async () => {
  // skip
}
