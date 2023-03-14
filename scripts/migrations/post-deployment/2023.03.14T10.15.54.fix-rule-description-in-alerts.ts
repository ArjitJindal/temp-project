import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleService } from '@/services/rules-engine'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()

  const ruleRepository = new RuleRepository(tenant.id, { dynamoDb })

  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleService = new RuleService(ruleRepository, ruleInstanceRepository)

  const rules = await ruleService.getAllRules()
  const ruleInstances = await ruleService.getAllRuleInstances()

  // rule instances to be stored in array whoes descriptions are not equal to the rule description
  const ruleInstancesToBeUpdated = ruleInstances.filter((ruleInstance) => {
    const rule = rules.find((rule) => rule.id === ruleInstance.ruleId)

    if (!rule) {
      return false
    }

    return ruleInstance.ruleDescriptionAlias !== rule.description
  })

  const ruleInstanceIds = ruleInstancesToBeUpdated.map(
    (ruleInstance) => ruleInstance.id
  )

  const casesCollectionName = CASES_COLLECTION(tenant.id)

  const db = mongoDb.db()
  const collection = db.collection<Case>(casesCollectionName)
  const cases = await collection
    .find({ 'alerts.ruleInstanceId': { $in: ruleInstanceIds } })
    .toArray()

  for await (const case_ of cases) {
    const alerts = case_?.alerts?.map((alert) => {
      const ruleInstance = ruleInstancesToBeUpdated.find(
        (ruleInstance) => ruleInstance.id === alert.ruleInstanceId
      )

      const rule = rules.find((rule) => rule.id === ruleInstance?.ruleId)

      if (ruleInstance) {
        return {
          ...alert,
          ruleDescription:
            ruleInstance.ruleDescriptionAlias ?? rule?.description ?? '',
        }
      }

      return alert
    })

    await collection.updateOne({ _id: case_._id }, { $set: { alerts } })
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
