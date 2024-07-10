/**
 * Usage:
 * 1. Implement `runReadOnlyQueryForTenant` and run `npm run cross-tenant-query:dev`
 * 2. Run `npm run cross-tenant-query:dev -- --query rule-stats`
 */

import { exit } from 'process'
import { program } from 'commander'
import { render } from 'prettyjson'
import { Db } from 'mongodb'
import { isEmpty, mergeWith, sortBy, startCase } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  PRODUCTION_REGIONS,
  Env,
  SANDBOX_REGIONS,
} from '@flagright/lib/constants/deploy'
import { getConfig, loadConfigEnv } from './migrations/utils/config'
import { TenantService } from '@/services/tenants'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import {
  RULES_LIBRARY,
  getRuleByRuleId,
} from '@/services/rules-engine/transaction-rules/library'
import {
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  USER_FILTERS,
} from '@/services/rules-engine/filters'
import { Feature } from '@/@types/openapi-internal/Feature'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { initializeTenantContext, withContext } from '@/core/utils/context'

/**
 * Custom query
 */
async function runReadOnlyQueryForTenant(
  _mongoDb: Db,
  _dynamoDb: DynamoDBDocumentClient,
  _tenantId: string
): Promise<any> {
  /**
   * Put your READ-ONLY query below and return a printable object
   * e.g
   * const result = await mongoDb
   *  .collection<InternalUser>(USERS_COLLECTION(tenantId))
   *  .find({})
   *  .limit(1)
   * return await result.toArray()
   */

  return { Hello: 'World' }
}

/**
 * Built-in query: rule Stats
 */
type CountStats = { [key: string]: number }
let globalRuleStats: CountStats = Object.fromEntries(
  RULES_LIBRARY.map((r) => [r.id, 0])
)
let globalFilterStats: CountStats = Object.fromEntries(
  Object.keys({
    ...TRANSACTION_FILTERS,
    ...TRANSACTION_HISTORICAL_FILTERS,
    ...USER_FILTERS,
  }).map((k) => [k, 0])
)
async function tenantRuleStats(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
): Promise<{ ruleStats: CountStats; filterStats: CountStats }> {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  const tenantRuleStats: CountStats = {}
  const tenantFilterStats: CountStats = {}
  ruleInstances.forEach((r) => {
    if (r.ruleId) {
      tenantRuleStats[r.ruleId] = (tenantRuleStats[r.ruleId] ?? 0) + 1
    }
  })
  ruleInstances
    .flatMap((r) => Object.keys(r.filters || {}))
    .forEach((k) => (tenantFilterStats[k] = (tenantFilterStats[k] ?? 0) + 1))

  return {
    ruleStats: tenantRuleStats,
    filterStats: tenantFilterStats,
  }
}
function printRuleStats(ruleStats: CountStats, filterStats: CountStats) {
  const sortedRuleStats = Object.fromEntries(
    sortBy(Object.entries(ruleStats), (entry) => -entry[1]).map((entry) => [
      `${entry[0]} (${getRuleByRuleId(entry[0])?.name})`,
      entry[1],
    ])
  )
  const sortedFileterStats = Object.fromEntries(
    sortBy(Object.entries(filterStats), (entry) => -entry[1]).map((entry) => [
      `${startCase(entry[0])} (${entry[0]})`,
      entry[1],
    ])
  )
  console.info('\nRules usage:')
  console.info(isEmpty(sortedRuleStats) ? 'N/A/' : render(sortedRuleStats))
  console.info('\nFilters usage:')
  console.info(isEmpty(sortedFileterStats) ? 'N/A' : render(sortedFileterStats))
}

/**
 * Built-in query: features
 */
async function tenantFeatures(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
): Promise<Feature[]> {
  const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
  const settings = await tenantRepository.getTenantSettings()
  return settings.features ?? []
}

program
  .requiredOption('--env <string>', 'dev | sandbox | prod')
  .option('--query <string>', 'rule-stats | features')
  .parse()

const { env, query } = program.opts()

if (!['dev', 'sandbox', 'prod'].includes(env)) {
  console.error(`Allowed --env options: dev, sandbox prod`)
  exit(1)
}

async function runReadOnlyQueryForEnv(env: Env) {
  process.env.ENV = env
  loadConfigEnv()
  const config = getConfig()
  const mongoDb = await getMongoDbClientDb(false)
  const dynamoDb = getDynamoDbClient()
  const tenantInfos = await TenantService.getAllTenants(
    config.stage,
    config.region
  )

  if (query === 'rule-stats') {
    for (const tenant of tenantInfos) {
      const result = await tenantRuleStats(dynamoDb, tenant.tenant.id)
      globalRuleStats = mergeWith(
        globalRuleStats,
        result.ruleStats,
        (a, b) => (a ?? 0) + (b ?? 0)
      )
      globalFilterStats = mergeWith(
        globalFilterStats,
        result.filterStats,
        (a, b) => (a ?? 0) + (b ?? 0)
      )

      if (!isEmpty(result.ruleStats) || !isEmpty(result.filterStats)) {
        console.info(
          `\nTenant: ${tenant.tenant.name} (ID: ${tenant.tenant.id}) (region: ${tenant.tenant.region})`
        )
        printRuleStats(result.ruleStats, result.filterStats)
      }
    }
  } else {
    for (const tenant of tenantInfos) {
      let result: any
      if (query === 'features') {
        result = await tenantFeatures(dynamoDb, tenant.tenant.id)
      } else {
        result = await withContext(async () => {
          await initializeTenantContext(tenant.tenant.id)
          return runReadOnlyQueryForTenant(mongoDb, dynamoDb, tenant.tenant.id)
        })
      }
      if (!isEmpty(result)) {
        console.info(
          `\nTenant: ${tenant.tenant.name} (ID: ${tenant.tenant.id}) (region: ${tenant.tenant.region})`
        )
        console.log(render(result))
      }
    }
  }
}

async function main() {
  if (env === 'dev') {
    await runReadOnlyQueryForEnv('dev')
  } else if (env === 'sandbox') {
    for (const region of SANDBOX_REGIONS) {
      await runReadOnlyQueryForEnv(`sandbox:${region}`)
    }
  } else if (env === 'prod') {
    for (const region of PRODUCTION_REGIONS) {
      await runReadOnlyQueryForEnv(`prod:${region}`)
    }
  }

  if (query === 'rule-stats') {
    console.info('\n================ All Tenants ================')
    printRuleStats(globalRuleStats, globalFilterStats)
  }
}

void main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
