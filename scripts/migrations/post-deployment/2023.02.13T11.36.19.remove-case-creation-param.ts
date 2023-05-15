import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { deleteUnusedRuleParameter } from '../utils/rule'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { OptionalPagination } from '@/utils/pagination'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb: mongodb,
  })

  const dynamodb = await getDynamoDbClient()
  const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, {
    dynamoDb: dynamodb,
  })
  const ruleRepo = new RuleRepository(tenant.id, {
    dynamoDb: dynamodb,
  })

  /** Delete case creation param in all rule */
  await deleteUnusedRuleParameter(undefined, [], ['defaultCaseCreationType'])
  const rules: any = await ruleRepo.getAllRules()
  for (const rule of rules) {
    console.log(`Migrate ruleInstance ${rule.id}`)
    if ('defaultCaseCreationType' in rule) {
      delete rule['defaultCaseCreationType']
    }
    await ruleRepo.createOrUpdateRule(rule)
  }
  /** Delete case creation param in all rule instances*/

  const ruleInstances: any = await ruleInstanceRepo.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    console.log(`Migrate ruleInstance ${ruleInstance.id}`)
    if ('caseCreationType' in ruleInstance) {
      delete ruleInstance['caseCreationType']
    }
    await ruleInstanceRepo.createOrUpdateRuleInstance(ruleInstance)
  }

  /** Delete caseType in all cases */

  const queryParams: OptionalPagination<DefaultApiGetCaseListRequest> = {
    pageSize: 'DISABLED',
  }
  queryParams.afterTimestamp = 0
  queryParams.beforeTimestamp = Date.now()
  const casesCursor = await caseRepository.getCasesCursor(queryParams)
  let caseObj = await casesCursor.next()
  while (caseObj) {
    if ('caseType' in caseObj) {
      delete caseObj['caseType']
      await caseRepository.addCaseMongo(caseObj)
    }
    caseObj = await casesCursor.next()
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  //skipped
}
