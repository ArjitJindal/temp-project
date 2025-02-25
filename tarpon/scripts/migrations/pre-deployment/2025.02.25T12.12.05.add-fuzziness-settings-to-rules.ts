import { compact } from 'lodash'
import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'

const RULES_TO_UPDATE = ['R-17', 'R-18', 'R-32', 'R-128', 'R-169', 'R-170']

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const now = Date.now()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const rulesToUpdate = (
    await ruleInstanceRepository.getAllRuleInstances()
  ).filter((r) => r.ruleId && RULES_TO_UPDATE.includes(r.ruleId))
  const updatedRules = compact(
    rulesToUpdate.map((r) => {
      if (r.parameters.fuzzinessSetting) {
        return undefined
      }
      return {
        ...r,
        parameters: {
          ...r.parameters,
          fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
        },
        ...(r.riskLevelParameters
          ? {
              riskLevelParameters: addFuzzinessSetting(r.riskLevelParameters),
            }
          : {}),
      }
    })
  )
  await pMap(
    updatedRules,
    async (r) => {
      await ruleInstanceRepository.createOrUpdateRuleInstance(r, now)
    },
    {
      concurrency: 10,
    }
  )
}

function addFuzzinessSetting(riskLevelParameters: RiskLevelRuleParameters) {
  for (const key of Object.keys(riskLevelParameters)) {
    if (!riskLevelParameters[key].fuzzinessSetting) {
      riskLevelParameters[key].fuzzinessSetting = 'LEVENSHTEIN_DISTANCE_DEFAULT'
    }
  }
  return riskLevelParameters
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
