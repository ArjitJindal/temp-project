/**
 * Usage:
 * 1. Implement `runReadOnlyQueryForTenant` and run `npm run cross-tenant-query:dev`
 * 2. Run `npm run cross-tenant-query:dev -- --query rule-stats`
 */

import { exit } from 'process'
import { execSync } from 'child_process'
import { program } from 'commander'
import { render } from 'prettyjson'
import { Db } from 'mongodb'
import {
  intersection,
  isEmpty,
  memoize,
  mergeWith,
  sortBy,
  startCase,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  PRODUCTION_REGIONS,
  Env,
  SANDBOX_REGIONS,
} from '@flagright/lib/constants/deploy'
import { CurrencyCode } from 'flagright/api'
import { getConfig, loadConfigEnv } from './migrations/utils/config'
import {
  createRuleInstancesLocally,
  deleteRuleInstancesLocally,
  verifyTransactionLocally,
} from './debug-rule/verify-remote-entities'
import { TenantService } from '@/services/tenants'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { getDynamoDbClient, getLocalDynamoDbClient } from '@/utils/dynamodb'
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
import { isV2RuleInstance } from '@/services/rules-engine/utils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import dayjs, { Dayjs } from '@/utils/dayjs'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { V8_MIGRATED_RULES } from '@/services/rules-engine/v8-migrations'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { logger } from '@/core/logger'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CurrencyService } from '@/services/currency'
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

// TODO: Remove this once all v2 rules are migrated to v8
async function validateV2ToV8Rules(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string,
  startDate: string,
  limit: number,
  targetRuleInstanceIds?: string[]
): Promise<any> {
  const BACKGROUND = '\x1b[37;41;1m'
  const NOCOLOR = '\x1b[0m'
  console.log(
    BACKGROUND +
      `Please set 'localChangeHandlerDisabled=true' in local-dynamodb-change-handler.ts` +
      NOCOLOR
  )
  execSync('npm run recreate-local-ddb --table=Tarpon >/dev/null 2>&1')
  logger.info(`Recreated local tarpon table`)
  logger.info(`Validating tenant ${tenantId}...`)
  const localDynamoDb = getLocalDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb: localDynamoDb,
  })
  for (const rule of RULES_LIBRARY) {
    await ruleRepository.createOrUpdateRule(rule)
  }
  const localRuleInstanceRepository = new RuleInstanceRepository(
    FLAGRIGHT_TENANT_ID,
    {
      dynamoDb: localDynamoDb,
    }
  )
  const ruleInstances = await localRuleInstanceRepository.getAllRuleInstances()
  if (ruleInstances.length > 0) {
    await deleteRuleInstancesLocally(ruleInstances.map((r) => r.id as string))
  }

  const mongoDb = await getMongoDbClient(false)
  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb,
    dynamoDb
  )
  const userRepository = new UserRepository(tenantId, { mongoDb })
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const v2RuleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances()
  )
    .filter(
      (v) =>
        isV2RuleInstance(v) &&
        V8_MIGRATED_RULES.includes(v.ruleId as string) &&
        (targetRuleInstanceIds
          ? targetRuleInstanceIds.includes(v.id as string)
          : true)
    )
    .map(
      (v) =>
        ({
          ...v,
          ruleRunMode: 'LIVE',
          ruleExecutionMode: 'SYNC',
          ...ruleInstanceRepository.getV8PropsForV2RuleInstance(v),
        } as RuleInstance)
    )
  if (v2RuleInstances.length === 0) {
    logger.info(`No active V2 rule instances found`)
    return {}
  }
  await createRuleInstancesLocally(v2RuleInstances)
  const ruleInstanceIds = v2RuleInstances.map((r) => r.id as string)

  const afterTimestamp = dayjs(startDate).valueOf()
  await updateLocalFeatureFlags(FLAGRIGHT_TENANT_ID, [])
  logger.info(`Verifying V2 rules...`)
  const v2HitResults = await verifyTransactions(
    transactionRepository,
    userRepository,
    afterTimestamp,
    ruleInstanceIds,
    limit
  )
  await updateLocalFeatureFlags(FLAGRIGHT_TENANT_ID, [
    'RULES_ENGINE_V8',
    'RULES_ENGINE_V8_FOR_V2_RULES',
  ])
  logger.info(`Verifying V8 rules...`)
  const v8HitResults = await verifyTransactions(
    transactionRepository,
    userRepository,
    afterTimestamp,
    ruleInstanceIds,
    limit
  )

  const result: {
    [ruleInstanceId: string]: {
      falseNotHit?: string[]
      falseHit?: string[]
      v2HitTransactionsCount: number
      v8HitTransactionsCount: number
    }
  } = {}
  for (const ruleInstanceId of ruleInstanceIds) {
    const v2HitTransactionIds = v2HitResults[ruleInstanceId] ?? []
    const v8HitTransactionIds = v8HitResults[ruleInstanceId] ?? []
    const hitTransactionIds = intersection(
      v2HitTransactionIds,
      v8HitTransactionIds
    )

    result[ruleInstanceId] = {
      v2HitTransactionsCount: v2HitTransactionIds.length,
      v8HitTransactionsCount: v8HitTransactionIds.length,
    }

    if (
      hitTransactionIds.length !== v2HitTransactionIds.length ||
      hitTransactionIds.length !== v8HitTransactionIds.length
    ) {
      const v8FalseNotHitTransactionIds = v2HitTransactionIds.filter(
        (id) => !v8HitTransactionIds.includes(id)
      )
      const v8FalseHitTransactionIds = v8HitTransactionIds.filter(
        (id) => !v2HitTransactionIds.includes(id)
      )
      result[ruleInstanceId].falseNotHit = v8FalseNotHitTransactionIds
      result[ruleInstanceId].falseHit = v8FalseHitTransactionIds
    }
  }
  return result
}

// TODO: Remove this once all v2 rules are migrated to v8
async function verifyTransactions(
  transactionRepository: MongoDbTransactionRepository,
  userRepository: UserRepository,
  afterTimestamp: number,
  ruleInstanceIds: string[],
  limit: number
): Promise<{
  [ruleInstanceId: string]: string[]
}> {
  const hitResults: { [ruleInstanceId: string]: string[] } = {}
  const getRemoteUser = memoize(async (userId: string) => {
    return await userRepository.getMongoUser(userId)
  })
  const txCursor = transactionRepository.getTransactionsCursor({
    afterTimestamp,
    sortField: 'timestamp',
    sortOrder: 'ascend',
    pageSize: 'DISABLED',
  })
  let txCount = 0
  // Verify using V2 rules
  for await (const transaction of txCursor) {
    logger.debug(`Verifying tx ${transaction.transactionId}`)
    let [originUser, destinationUser] = await Promise.all([
      transaction.originUserId
        ? getRemoteUser(transaction.originUserId)
        : undefined,
      transaction.destinationUserId
        ? getRemoteUser(transaction.destinationUserId)
        : undefined,
    ])
    originUser = originUser?.type ? originUser : null
    destinationUser = destinationUser?.type ? destinationUser : null
    const result = await verifyTransactionLocally(
      transaction,
      originUser,
      destinationUser
    )
    result.hitRules.forEach((r) => {
      if (ruleInstanceIds.includes(r.ruleInstanceId)) {
        if (!hitResults[r.ruleInstanceId]) {
          hitResults[r.ruleInstanceId] = []
        }
        hitResults[r.ruleInstanceId].push(transaction.transactionId)
      }
    })

    txCount++
    if (txCount >= limit) {
      break
    }
  }
  logger.info(`Verified ${txCount} transactions`)
  return hitResults
}

async function updateLocalFeatureFlags(
  tenantId: string,
  featureFlags: Feature[]
) {
  const dynamoDb = getLocalDynamoDbClient()
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
  })
  await tenantRepository.createOrUpdateTenantSettings({
    features: featureFlags,
  })
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
  .option(
    '--query <string>',
    'rule-stats | features | validate-v2-to-v8-rules | sales-flagright-report'
  )
  // validate-v2-to-v8-rules options
  .option('--start-date <string>', 'YYYY-MM-DD', 'Start date')
  .option('--end-date <string>', 'YYYY-MM-DD', 'End date')
  .option('--limit <number>', 'Number of entities to verify')
  .option('--tenant-ids <string>', 'Comma-separated list of tenant IDs')
  .option(
    '--rule-instance-ids <string>',
    'Comma-separated list of rule instance IDs'
  )
  .parse()

const { env, query, startDate, endDate, limit, tenantIds, ruleInstanceIds } =
  program.opts()

if (!['dev', 'sandbox', 'prod'].includes(env)) {
  console.error(`Allowed --env options: dev, sandbox prod`)
  exit(1)
}

const exchangeRates = memoize(async (dynamoDb: DynamoDBDocumentClient) => {
  const currencyService = new CurrencyService(dynamoDb)
  return await currencyService.getExchangeRates()
})

const globalMetricsData = {
  totalTransactionsProcessed: 0,
  totalAmountOfTransactionsProcessedInUSD: 0,
  totalUserProfiles: 0,
}

async function salesFlagrightReport(
  mongoDb: Db,
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string,
  { startDate, endDate }: { startDate: Dayjs; endDate: Dayjs }
) {
  const totalTransactionsProcessedPromise = mongoDb
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
    .countDocuments({
      createdAt: { $gte: startDate.valueOf(), $lte: endDate.valueOf() },
    })

  const amountOfTransactionsProcessedPerCurrencyPromise = mongoDb
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
    .aggregate<{
      _id: CurrencyCode
      total: number
    }>([
      {
        $match: {
          timestamp: { $gte: startDate.valueOf(), $lte: endDate.valueOf() },
        },
      },
      {
        $project: {
          amountDetails: {
            $cond: {
              if: { $ne: ['$originAmountDetails', null] },
              then: '$originAmountDetails',
              else: '$destinationAmountDetails',
            },
          },
        },
      },
      {
        $group: {
          _id: '$amountDetails.transactionCurrency',
          total: { $sum: '$amountDetails.transactionAmount' },
        },
      },
    ])
    .toArray()

  const totalUserProfilesPromise = mongoDb
    .collection<InternalUser>(USERS_COLLECTION(tenantId))
    .countDocuments({
      createdAt: { $gte: startDate.valueOf(), $lte: endDate.valueOf() },
    })

  const [
    totalTransactionsProcessed,
    amountOfTransactionsProcessedPerCurrency,
    totalUserProfiles,
  ] = await Promise.all([
    totalTransactionsProcessedPromise,
    amountOfTransactionsProcessedPerCurrencyPromise,
    totalUserProfilesPromise,
  ])

  const currencyExchangeRates = await exchangeRates(dynamoDb)
  const totalAmountOfTransactionsProcessedInUSD =
    amountOfTransactionsProcessedPerCurrency.reduce((acc, curr) => {
      if (!curr._id || !currencyExchangeRates[curr._id]) {
        console.log(`No currency for transaction ${curr.total}`)
        return acc
      }

      const exchangeRate = currencyExchangeRates[curr._id]
      // ALL exchange rates are comparable to USD
      return acc + curr.total / exchangeRate
    }, 0)

  return {
    totalTransactionsProcessed,
    totalAmountOfTransactionsProcessedInUSD,
    totalUserProfiles,
  }
}

async function runReadOnlyQueryForEnv(env: Env) {
  process.env.ENV = env
  loadConfigEnv()
  const config = getConfig()
  const mongoDb = await getMongoDbClientDb(false)
  const dynamoDb = getDynamoDbClient()
  let tenantInfos = await TenantService.getAllTenants(
    config.stage,
    config.region
  )
  if (tenantIds) {
    const targetTenantIds = tenantIds.split(',')
    tenantInfos = tenantInfos.filter((t) =>
      targetTenantIds.includes(t.tenant.id)
    )
  }

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
  } else if (query === 'sales-flagright-report') {
    /**
     * To get data for a specific date range, run:
     * npm run cross-tenant-query:prod -- --query=sales-flagright-report --start-date=2025-01-01 --end-date=2025-02-01
     */
    const metricsDataPerRegion = {
      totalTransactionsProcessed: 0,
      totalAmountOfTransactionsProcessedInUSD: 0,
      totalUserProfiles: 0,
    }
    for (const tenant of tenantInfos) {
      const startDateFormatted = dayjs(startDate, 'YYYY-MM-DD')
      const endDateFormatted = dayjs(endDate, 'YYYY-MM-DD')
      const result = await salesFlagrightReport(
        mongoDb,
        dynamoDb,
        tenant.tenant.id,
        {
          startDate: startDateFormatted,
          endDate: endDateFormatted,
        }
      )
      console.info(
        `\nTenant: ${tenant.tenant.name} (ID: ${tenant.tenant.id}) (region: ${tenant.tenant.region})`
      )
      console.log(render(result))
      metricsDataPerRegion.totalTransactionsProcessed +=
        result.totalTransactionsProcessed
      metricsDataPerRegion.totalAmountOfTransactionsProcessedInUSD +=
        result.totalAmountOfTransactionsProcessedInUSD
      metricsDataPerRegion.totalUserProfiles += result.totalUserProfiles
    }
    console.log(`Region: ${env}`)
    console.log(render(metricsDataPerRegion))
    globalMetricsData.totalTransactionsProcessed +=
      metricsDataPerRegion.totalTransactionsProcessed
    globalMetricsData.totalAmountOfTransactionsProcessedInUSD +=
      metricsDataPerRegion.totalAmountOfTransactionsProcessedInUSD
    globalMetricsData.totalUserProfiles +=
      metricsDataPerRegion.totalUserProfiles
    console.log(`Global:`)
    console.log(render(globalMetricsData))
  } else {
    for (const tenant of tenantInfos) {
      let result: any
      if (query === 'features') {
        result = await tenantFeatures(dynamoDb, tenant.tenant.id)
      } else {
        result = await withContext(async () => {
          await initializeTenantContext(tenant.tenant.id)

          if (query === 'validate-v2-to-v8-rules') {
            return validateV2ToV8Rules(
              dynamoDb,
              tenant.tenant.id,
              startDate,
              Number(limit),
              ruleInstanceIds?.split(',')
            )
          }
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

  if (query === 'sales-flagright-report') {
    console.info('\n================ All Tenants ================')
    console.log(render(globalMetricsData))
  }
}

void main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
