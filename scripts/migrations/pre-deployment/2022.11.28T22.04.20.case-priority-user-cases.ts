import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { CasePriority } from '@/@types/openapi-public-management/CasePriority'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const caseRepositry = new CaseRepository(tenant.id, {
    mongoDb,
  })

  const rulesInstances = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const allRulesInstances = await rulesInstances.getAllRuleInstances()
  const rulesInstancesMap = _.keyBy(allRulesInstances, 'id')

  const cursor = await caseRepositry.getCasesCursor({
    includeTransactions: true,
    pageSize: 'DISABLED',
    filterCaseType: 'USER',
  })

  for await (const c of cursor) {
    if (!c.caseId || c.priority || !c?.caseTransactions?.length) {
      continue
    }
    if (!c.priority) {
      const priorities: CasePriority[] = []
      if (c?.caseTransactions?.length) {
        for (const caseTransaction of c.caseTransactions) {
          for (const hitRule of caseTransaction.hitRules) {
            const ruleInstance = rulesInstancesMap[hitRule.ruleInstanceId]
            if (ruleInstance) {
              priorities.push(ruleInstance.casePriority)
            }
          }
        }
        console.log(`Case ${c.caseId} has priorities ${priorities}`)

        const maxPriority = _.min(priorities) // max priority will be minimum lexiographically (i.e. highest priority)

        await caseRepositry.addCaseMongo({
          ...c,
          priority: maxPriority ?? ('P4' as unknown as CasePriority),
        })
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
