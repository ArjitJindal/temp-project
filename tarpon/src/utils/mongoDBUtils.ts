import { StackConstants } from '@lib/constants'
import {
  Collection,
  CreateIndexesOptions,
  Db,
  Document,
  FindCursor,
  FindOptions,
  MongoClient,
  WithId,
} from 'mongodb'
import _ from 'lodash'
import { escapeStringRegexp } from './regex'
import { getSecret } from './secrets-manager'
import { MONGO_TEST_DB_NAME } from '@/test-utils/mongo-test-utils'
import {
  DEFAULT_PAGE_SIZE,
  getPageSizeNumber,
  MAX_PAGE_SIZE,
  OptionalPaginationParams,
  PageSize,
} from '@/utils/pagination'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { Case } from '@/@types/openapi-internal/Case'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { logger } from '@/core/logger'
import { exponentialRetry } from '@/utils/retry'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'

interface DBCredentials {
  username: string
  password: string
  host: string
}

const ATLAS_CREDENTIALS_SECRET_ARN = process.env
  .ATLAS_CREDENTIALS_SECRET_ARN as string

let cacheClient: MongoClient

export async function getMongoDbClient(
  dbName = StackConstants.MONGO_DB_DATABASE_NAME
) {
  if (cacheClient) {
    return cacheClient
  }
  if (process.env.NODE_ENV === 'test') {
    return await MongoClient.connect(
      process.env.MONGO_URI || `mongodb://localhost:27018/${MONGO_TEST_DB_NAME}`
    )
  }
  if (process.env.ENV === 'local') {
    return await MongoClient.connect(`mongodb://localhost:27018/${dbName}`)
  }

  const credentials = await getSecret<DBCredentials>(
    ATLAS_CREDENTIALS_SECRET_ARN as string
  )
  const DB_USERNAME = credentials['username']
  const DB_PASSWORD = encodeURIComponent(credentials['password'])
  const DB_HOST = credentials['host']
  const DB_URL = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}/${dbName}`
  cacheClient = await MongoClient.connect(DB_URL as string)
  return cacheClient
}

export function success(body: object): object {
  return buildResponse(200, body)
}

export function failure(body: object): object {
  return buildResponse(500, body)
}

export function notFound(body: object): object {
  return buildResponse(404, body)
}

function buildResponse(statusCode: number, body: object): object {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  }
}

export const TRANSACTIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-transactions`
}

export const NARRATIVE_TEMPLATE_COLLECTION = (tenantId: string) => {
  return `${tenantId}-narratives`
}

export const CASES_COLLECTION = (tenandId: string) => {
  return `${tenandId}-cases`
}

export const METRICS_COLLECTION = (tenandId: string) => {
  return `${tenandId}-metrics`
}

export const COUNTER_COLLECTION = (tenandId: string) => {
  return `${tenandId}-counter`
}

export const USERS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-users`
}

export const ACCOUNTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-accounts`
}

export const TRANSACTION_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-transaction-events`
}

export const USER_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-user-events`
}

export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-monthly`
}

export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-daily`
}

export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-hourly`
}

export const DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-rule-stats-hourly`
}

export const DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-hits-by-user-stats-hourly`
}

export const DASHBOARD_TEAM_CASES_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-team-cases-stats-hourly`
}

export const DASHBOARD_TEAM_ALERTS_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-team-alerts-stats-hourly`
}

export const REPORT_COLLECTION = (tenandId: string) => {
  return `${tenandId}-report`
}

// Pulse
export const KRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-kyc-risk-values`
}
export const ARS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-action-risk-values`
}
export const DRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-dynamic-risk-values`
}

export const DRS_SCORES_DISTRIBUTION_STATS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-drs-scores-distribution`
}

export const IMPORT_COLLECTION = (tenantId: string) => {
  return `${tenantId}-import`
}

export const METADATA_COLLECTION = (tenantId: string) => {
  return `${tenantId}-metadata`
}

export const WEBHOOK_COLLECTION = (tenantId: string) => {
  return `${tenantId}-webhooks`
}

export const WEBHOOK_DELIVERY_COLLECTION = (tenantId: string) => {
  return `${tenantId}-webhook-deliveries`
}

export const SANCTIONS_SEARCHES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-searches`
}

export const SANCTIONS_WHITELIST_ENTITIES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-whitelist-entities`
}

export const IBAN_COM_COLLECTION = (tenantId: string) => {
  return `${tenantId}-iban-com`
}

export const AUDITLOG_COLLECTION = (tenantId: string) => {
  return `${tenantId}-auditlog`
}

export const SIMULATION_TASK_COLLECTION = (tenantId: string) => {
  return `${tenantId}-simulation-task`
}

export const SIMULATION_RESULT_COLLECTION = (tenantId: string) => {
  return `${tenantId}-simulation-result`
}

export const MERCHANT_MONITORING_DATA_COLLECTION = (tenantId: string) => {
  return `${tenantId}-merchant-monitoring`
}

export const MIGRATION_TMP_COLLECTION = 'migration-tmp'

export const MONTH_DATE_FORMAT = '%Y-%m'
export const DAY_DATE_FORMAT = '%Y-%m-%d'
export const HOUR_DATE_FORMAT = '%Y-%m-%dT%H'

export const MONTH_DATE_FORMAT_JS = 'YYYY-MM'
export const DAY_DATE_FORMAT_JS = 'YYYY-MM-DD'
export const HOUR_DATE_FORMAT_JS = 'YYYY-MM-DD[T]HH'

/** Device DATA Metrics collection */
export const DEVICE_DATA_COLLECTION = (tenantId: string) => {
  return `${tenantId}-device-data-metrics`
}

/*
  Pagination
 */
export function getSkipAndLimit<Params extends OptionalPaginationParams>(
  params: Params
): {
  limit: number
  skip: number
} {
  let pageSize: PageSize | 'DISABLED' = DEFAULT_PAGE_SIZE
  let page = 1

  if ('pageSize' in params) {
    const pageSizeParam = params['pageSize']
    if (typeof pageSizeParam === 'number') {
      pageSize = pageSizeParam
    } else if (typeof pageSizeParam === 'string') {
      pageSize =
        pageSizeParam === 'DISABLED'
          ? 'DISABLED'
          : Math.max(
              1,
              Math.min(
                parseInt(pageSizeParam) || DEFAULT_PAGE_SIZE,
                MAX_PAGE_SIZE
              )
            )
    }
  }
  if (typeof params['page'] === 'number') {
    page = Math.max(1, params['page'])
  } else if (typeof params['page'] === 'string') {
    page = Math.max(1, parseInt(params['page']) || 1)
  }

  const pageSizeAsNumber = getPageSizeNumber(pageSize)

  return {
    limit: pageSizeAsNumber,
    skip: (page - 1) * pageSizeAsNumber,
  }
}

export function paginateFindOptions<Params extends OptionalPaginationParams>(
  params: Params
): FindOptions {
  if (params.pageSize === 'DISABLED') {
    return {}
  }
  const { skip, limit } = getSkipAndLimit(params)
  return {
    skip,
    limit,
  }
}

type lookupPipelineStageStage = {
  from: string
  localField: string
  foreignField: string
  as: string
  pipeline?: Document[]
  _let?: Document
}

export function lookupPipelineStage(
  params: lookupPipelineStageStage,
  disablePipeline = false
): Document {
  return {
    $lookup: {
      from: params.from,
      localField: params.localField,
      foreignField: params.foreignField,
      as: params.as,
      ...(params._let ? { let: params._let } : {}),
      ...(!disablePipeline
        ? {
            pipeline: [
              {
                $match: {
                  [params.foreignField]: {
                    $exists: true,
                    $nin: [null, undefined],
                  },
                },
              },
              ...(params.pipeline || []),
            ],
          }
        : {}),
    },
  }
}

export function paginateCursor<
  Params extends OptionalPaginationParams,
  TSchema
>(
  cursor: FindCursor<WithId<TSchema>>,
  params: Params
): FindCursor<WithId<TSchema>> {
  if (params.pageSize === 'DISABLED') {
    return cursor
  }
  const { skip, limit } = getSkipAndLimit(params)
  return cursor.skip(skip).limit(limit)
}

export function paginatePipeline<Params extends OptionalPaginationParams>(
  params: Params
): Document[] {
  if (params.pageSize === 'DISABLED') {
    return []
  }
  const { skip, limit } = getSkipAndLimit(params)
  return [{ $skip: skip }, { $limit: limit }]
}

/**
 * Matching utils
 */

// This should be the default regex filter to use for performance concerns
// Ref: https://www.mongodb.com/docs/manual/reference/operator/query/regex/#index-use
export function prefixRegexMatchFilter(input: string, caseInsensitive = false) {
  return {
    $regex: `^${escapeStringRegexp(input)}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export function regexMatchFilter(input: string, caseInsensitive = false) {
  return {
    $regex: `${escapeStringRegexp(input)}`,
    $options: caseInsensitive ? 'i' : '',
  }
}

export const createMongoDBCollections = async (
  mongoClient: MongoClient,
  tenantId: string
) => {
  const db = mongoClient.db()
  try {
    try {
      await db.createCollection(TRANSACTIONS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const transactionCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )

    const txnIndexes: Document[] = [
      'arsScore.arsScore',
      'arsScore.riskLevel',
      'caseStatus',
      'createdAt',
      'destinationAmountDetails.country',
      'destinationAmountDetails.transactionAmount',
      'destinationAmountDetails.transactionCurrency',
      'destinationPaymentDetails.country',
      'destinationPaymentDetails.method',
      'originPaymentMethodId',
      'destinationPaymentMethodId',
      'destinationUserId',
      'executedRules.ruleHit',
      'executedRules.ruleId',
      'executedRules.ruleInstanceId',
      'hitRules.ruleAction',
      'hitRules.ruleInstanceId',
      'originAmountDetails.country',
      'originAmountDetails.transactionAmount',
      'originAmountDetails.transactionCurrency',
      'originPaymentDetails.country',
      'originPaymentDetails.method',
      'originUserId',
      'status',
      'tags.key',
      'timestamp',
      'transactionId',
      'transactionState',
      'type',
    ].flatMap((i) => {
      return [{ [i]: 1, _id: 1 }]
    })

    txnIndexes.push(
      {
        transactionId: 1,
        timestamp: 1,
      },
      {
        originUserId: 1,
        timestamp: 1,
        _id: 1,
      },
      {
        destinationUserId: 1,
        timestamp: 1,
        _id: 1,
      },
      {
        originUserId: 1,
        timestamp: -1,
        _id: -1,
      },
      {
        destinationUserId: 1,
        timestamp: -1,
        _id: -1,
      },
      {
        arsScore: 1,
      }
    )

    // NOTE: These indexes are for running the rules in the Simulation mode
    for (const fields of Object.values(PAYMENT_METHOD_IDENTIFIER_FIELDS)) {
      txnIndexes.push({
        'originPaymentDetails.method': 1,
        ...Object.fromEntries(
          fields.map((field) => [`originPaymentDetails.${field}`, 1])
        ),
      })
      txnIndexes.push({
        'destinationPaymentDetails.method': 1,
        ...Object.fromEntries(
          fields.map((field) => [`destinationPaymentDetails.${field}`, 1])
        ),
      })
    }
    await syncIndexes(transactionCollection, txnIndexes)

    try {
      await db.createCollection(USERS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const usersCollection = db.collection(USERS_COLLECTION(tenantId))

    const userIndexes = [
      {
        type: 1,
      },
      {
        createdTimestamp: 1,
      },
      {
        createdTimestamp: -1,
      },
      {
        createdAt: 1,
      },
      {
        userId: 1,
      },
      {
        'userDetails.name.firstName': 1,
      },
      {
        'userDetails.name.middleName': 1,
      },
      {
        'userDetails.name.lastName': 1,
      },
      {
        'legalEntity.companyGeneralDetails.legalName': 1,
      },
      {
        'legalEntity.companyGeneralDetails.businessIndustry': 1,
      },
    ]

    await syncIndexes(usersCollection, userIndexes)

    try {
      await db.createCollection(USER_EVENTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const userEventsCollection = db.collection(USER_EVENTS_COLLECTION(tenantId))
    const userEventsIndexes: Document[] = [
      {
        eventId: 1,
      },
      {
        createdAt: 1,
      },
    ]

    await syncIndexes(userEventsCollection, userEventsIndexes)

    try {
      await db.createCollection(TRANSACTION_EVENTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const transactionEventsCollection = db.collection(
      TRANSACTION_EVENTS_COLLECTION(tenantId)
    )
    const transactionEventsIndexes: Document[] = [
      {
        transactionId: 1,
        transactionState: 1,
        timestamp: -1,
      },
      {
        eventId: 1,
      },
      {
        createdAt: 1,
      },
    ]

    await syncIndexes(transactionEventsCollection, transactionEventsIndexes)
    try {
      await db.createCollection(CASES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const casesIndexes: Document[] = [
      { availableAfterTimestamp: 1 },
      { caseId: 1 },
      { createdTimestamp: -1 },
      { caseStatus: 1, createdTimestamp: 1 },
      { 'caseUsers.origin.userId': 1 },
      { 'caseUsers.destination.userId': 1 },
      { 'caseTransactions.transactionId': 1 },
      { 'caseTransactions.status': 1 },
      { 'caseTransactions.destinationAmountDetails.transactionCurrency': 1 },
      { 'caseTransactions.destinationAmountDetails.transactionAmount': 1 },
      { 'caseTransactions.destinationAmountDetails.country': 1 },
      { 'caseTransactions.destinationPaymentDetails.method': 1 },
      { 'caseTransactions.originAmountDetails.country': 1 },
      { 'caseTransactions.originAmountDetails.transactionAmount': 1 },
      { 'caseTransactions.originAmountDetails.transactionCurrency': 1 },
      { 'caseTransactions.originPaymentDetails.method': 1 },
      { 'caseTransactions.timestamp': 1 },
      {
        'caseUsers.destination.legalEntity.companyGeneralDetails.businessIndustry': 1,
      },
      {
        'caseUsers.origin.legalEntity.companyGeneralDetails.businessIndustry': 1,
      },
      { 'caseUsers.originUserDrsScore': 1 },
      { 'caseUsers.destinationUserDrsScore': 1 },
      { 'caseTransactions.arsScore': 1 },
      { 'assignments.assigneeUserId': 1 },
      { 'assignments.timestamp': 1 },
      { 'statusChanges.timestamp': 1 },
      { 'statusChanges.caseStatus': 1 },
      { 'alerts.statusChanges.timestamp': 1 },
      { 'alerts.statusChanges.caseStatus': 1 },
      { 'lastStatusChange.timestamp': 1 },
      { 'alerts._id': 1 },
      { 'alerts.lastStatusChange.timestamp': 1 },
      { 'alerts.alertId': 1 },
      { 'alerts.alertStatus': 1 },
      { 'alerts.assignments.assigneeUserId': 1 },
      { 'alerts.assignments.timestamp': 1 },
      { 'alerts.priority': 1 },
      { 'alerts.createdTimestamp': 1 },
      { 'alerts.numberOfTransactionsHit': 1 },
    ]

    await syncIndexes(casesCollection, casesIndexes)

    try {
      await db.createCollection(AUDITLOG_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const auditlogCollection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(tenantId)
    )
    const auditlogIndexes: Document[] = [
      { auditlogId: 1 },
      { timestamp: -1 },
      { type: 1, action: 1 },
      { entityId: 1 },
    ]

    await syncIndexes(auditlogCollection, auditlogIndexes)

    try {
      await db.createCollection(SIMULATION_TASK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationTaskCollection = db.collection(
      SIMULATION_TASK_COLLECTION(tenantId)
    )
    const simulationTaskIndexes: Document[] = [{ type: 1, createdAt: -1 }]

    await syncIndexes(simulationTaskCollection, simulationTaskIndexes)

    try {
      await db.createCollection(SIMULATION_RESULT_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationResultCollection = db.collection(
      SIMULATION_RESULT_COLLECTION(tenantId)
    )
    const simulationResultIndexes: Document[] = [{ taskId: 1 }]

    await syncIndexes(simulationResultCollection, simulationResultIndexes)

    try {
      await db.createCollection(ACCOUNTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const accountsCollectionIndexes: Document[] = [{ id: 1 }]

    await syncIndexes(
      db.collection(ACCOUNTS_COLLECTION(tenantId)),
      accountsCollectionIndexes,
      { unique: true }
    )

    try {
      await db.createCollection(KRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const krsScoresCollection = db.collection(KRS_SCORES_COLLECTION(tenantId))
    const krsScoresIndexes: Document[] = [{ userId: 1 }]

    await syncIndexes(krsScoresCollection, krsScoresIndexes)

    try {
      await db.createCollection(ARS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const arsScoresCollection = db.collection(ARS_SCORES_COLLECTION(tenantId))
    const arsScoresIndexes: Document[] = [{ transactionId: 1 }]

    await syncIndexes(arsScoresCollection, arsScoresIndexes)

    try {
      await db.createCollection(DRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const drsScoresCollection = db.collection(DRS_SCORES_COLLECTION(tenantId))
    const drsScoresIndexes: Document[] = [{ userId: 1 }]

    await syncIndexes(drsScoresCollection, drsScoresIndexes)

    try {
      await db.createCollection(WEBHOOK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const webhookCollection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(tenantId)
    )
    const webhookIndexes: Document[] = [{ events: 1 }]

    await syncIndexes(webhookCollection, webhookIndexes)

    try {
      await db.createCollection(WEBHOOK_DELIVERY_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const webhookDeliveryCollection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(tenantId)
    )
    const webhookDeliveryIndexes: Document[] = [
      { webhookId: 1, requestStartedAt: -1 },
      { deliveryTaskId: 1, deliveredAt: 1 },
    ]

    await syncIndexes(webhookDeliveryCollection, webhookDeliveryIndexes)
  } catch (e) {
    logger.error(`Error in creating MongoDB collections: ${e}`)
  }

  try {
    await db.createCollection(SANCTIONS_SEARCHES_COLLECTION(tenantId))
  } catch (e) {
    // ignore already exists
  }
  const sanctionsSearchesCollection = db.collection(
    SANCTIONS_SEARCHES_COLLECTION(tenantId)
  )

  const sanctionsSearchesIndexes: Document[] = [
    { createdAt: 1 },
    { 'response.rawComplyAdvantageResponse.content.data.id': 1 },
  ]

  await syncIndexes(sanctionsSearchesCollection, sanctionsSearchesIndexes)

  try {
    await db.createCollection(NARRATIVE_TEMPLATE_COLLECTION(tenantId))
  } catch (e) {
    // ignore already exists
  }

  const narrativeTemplateCollection = db.collection(
    NARRATIVE_TEMPLATE_COLLECTION(tenantId)
  )

  const narrativeTemplateIndexes: Document[] = [
    { id: 1 },
    { name: 1 },
    { description: 1 },
    { createdAt: 1 },
  ]

  await syncIndexes(narrativeTemplateCollection, narrativeTemplateIndexes)

  try {
    const dashboardTeamCasesStatsHourly = await db.createCollection(
      DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)
    )

    const dashboardTeamCasesStatsHourlyIndexes = [
      { date: -1, accountId: 1, status: 1 },
    ]
    await syncIndexes(
      dashboardTeamCasesStatsHourly,
      dashboardTeamCasesStatsHourlyIndexes,
      { unique: true }
    )
  } catch (e) {
    // ignore already exists
  }

  try {
    const dashboardTeamAlertsStatsHourly = await db.createCollection(
      DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
    )
    const dashboardTeamAlertsStatsHourlyIndexes: Document[] = [
      { date: -1, accountId: 1, status: 1 },
    ]
    await syncIndexes(
      dashboardTeamAlertsStatsHourly,
      dashboardTeamAlertsStatsHourlyIndexes,
      { unique: true }
    )
  } catch (e) {
    // ignore already exists
  }
}

export async function allCollections(tenantId: string, db: Db) {
  const re = new RegExp(tenantId + `-((?!test).+)`)
  const collections = await db
    .listCollections({
      name: re,
    })
    .toArray()

  return collections.map((c) => c.name)
}

export async function syncIndexes<T>(
  collection: Collection<T>,
  indexes: Document[],
  options?: CreateIndexesOptions
) {
  const currentIndexes = await collection.indexes()

  // Remove orphaned indexes
  await Promise.all(
    currentIndexes.map(async (current) => {
      // Dont drop ID index
      if (current.name === '_id_') {
        return
      }

      // If index is not desired, delete it
      if (!indexes.find((desired) => _.isEqual(desired, current.key))) {
        logger.info(`Dropping ${current.name}...`)
        await exponentialRetry(
          async () => await collection.dropIndex(current.name)
        )
      }
    })
  )

  const indexesToCreate = indexes.filter(
    (desired) =>
      !currentIndexes.find((current) => _.isEqual(desired, current.key))
  )

  if (indexesToCreate.length > 64) {
    throw new Error("Can't create more than 64 indexes")
  }

  if (indexesToCreate.length > 0) {
    logger.info(`Creating indexes...`)
    await Promise.all(
      indexesToCreate.map((index) =>
        exponentialRetry(
          async () => await collection.createIndex(index, options)
        )
      )
    )
  }
}

export const withTransaction = async (callback: () => Promise<void>) => {
  const mongoDb = await getMongoDbClient()
  const session = mongoDb.startSession()

  session.startTransaction()
  try {
    await callback()
    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
}
