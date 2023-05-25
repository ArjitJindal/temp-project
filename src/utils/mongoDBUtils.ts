import { StackConstants } from '@lib/constants'
import {
  Db,
  Document,
  FindCursor,
  FindOptions,
  MongoClient,
  WithId,
} from 'mongodb'
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
    await transactionCollection.createIndex({
      timestamp: -1,
    })

    await Promise.all(
      [
        'timestamp',
        'arsScore.arsScore',
        'arsScore.riskLevel',
        'transactionState',
        'originUserId',
        'destinationUserId',
        'originAmountDetails.transactionAmount',
        'destinationAmountDetails.transactionAmount',
      ].map(async (i) => {
        await transactionCollection.createIndex({ [i]: 1, _id: 1 })
        await transactionCollection.createIndex({ [i]: -1, _id: -1 })
        return
      })
    )

    await transactionCollection.createIndex({
      type: 1,
      status: 1,
      timestamp: -1,
    })
    await transactionCollection.createIndex({ transactionId: 1 })
    await transactionCollection.createIndex({
      destinationUserId: 1,
      timestamp: -1,
    })
    await transactionCollection.createIndex({ originUserId: 1, timestamp: -1 })
    await transactionCollection.createIndex({
      'destinationAmountDetails.transactionCurrency': 1,
    })
    await transactionCollection.createIndex({
      'originAmountDetails.transactionCurrency': 1,
    })
    await transactionCollection.createIndex({
      'destinationPaymentDetails.method': 1,
    })
    await transactionCollection.createIndex({
      'originAmountDetails.country': 1,
    })
    await transactionCollection.createIndex({
      'destinationPaymentDetails.country': 1,
    })
    await transactionCollection.createIndex({
      'originPaymentDetails.method': 1,
    })
    await transactionCollection.createIndex({
      'originPaymentDetails.method': 1,
      'originPaymentDetails.paymentChannel': 1,
    })
    await transactionCollection.createIndex({
      transactionState: 1,
    })
    await transactionCollection.createIndex({
      type: 1,
    })
    await transactionCollection.createIndex({
      'tags.key': 1,
    })
    await transactionCollection.createIndex({
      'hitRules.ruleAction': 1,
    })

    for (const fields of Object.values(PAYMENT_METHOD_IDENTIFIER_FIELDS)) {
      await transactionCollection.createIndex({
        'originPaymentDetails.method': 1,
        ...Object.fromEntries(
          fields.map((field) => [`originPaymentDetails.${field}`, 1])
        ),
      })
      await transactionCollection.createIndex({
        'destinationPaymentDetails.method': 1,
        ...Object.fromEntries(
          fields.map((field) => [`destinationPaymentDetails.${field}`, 1])
        ),
      })
    }

    try {
      await db.createCollection(USERS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const usersCollection = db.collection(USERS_COLLECTION(tenantId))
    await usersCollection.createIndex({
      type: 1,
      createdTimestamp: -1,
    })
    await usersCollection.createIndex({
      userId: 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.firstName': 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.middleName': 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.lastName': 1,
    })
    await usersCollection.createIndex({
      'legalEntity.companyGeneralDetails.legalName': 1,
    })
    await usersCollection.createIndex({
      'legalEntity.companyGeneralDetails.businessIndustry': 1,
    })

    try {
      await db.createCollection(USER_EVENTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const userEventsCollection = db.collection(USER_EVENTS_COLLECTION(tenantId))
    await userEventsCollection.createIndex({
      eventId: 1,
    })

    try {
      await db.createCollection(TRANSACTION_EVENTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const transactionEventsCollection = db.collection(
      TRANSACTION_EVENTS_COLLECTION(tenantId)
    )
    await transactionEventsCollection.createIndex({
      transactionId: 1,
      transactionState: 1,
      timestamp: -1,
    })
    await transactionEventsCollection.createIndex({
      eventId: 1,
    })
    try {
      await db.createCollection(CASES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    await casesCollection.createIndex({ caseId: 1 })
    await casesCollection.createIndex({
      createdTimestamp: -1,
    })
    await casesCollection.createIndex({
      caseStatus: 1,
      createdTimestamp: 1,
    })
    await casesCollection.createIndex({ 'caseUsers.origin.userId': 1 })
    await casesCollection.createIndex({ 'caseUsers.destination.userId': 1 })
    await casesCollection.createIndex({
      'caseUsers.origin.userId': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destination.userId': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.transactionId': 1,
    })
    await casesCollection.createIndex({ 'caseTransactions.status': 1 })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.transactionCurrency': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.transactionCurrency': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationPaymentDetails.method': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originPaymentDetails.method': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.timestamp': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.transactionAmount': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.transactionAmount': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.country': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.country': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destination.legalEntity.companyGeneralDetails.businessIndustry': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.origin.legalEntity.companyGeneralDetails.businessIndustry': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.originUserDrsScore': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destinationUserDrsScore': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.arsScore': 1,
    })
    await casesCollection.createIndex({
      'assignments.assigneeUserId': 1,
    })
    await casesCollection.createIndex({
      'assignments.timestamp': 1,
    })
    await casesCollection.createIndex({
      'statusChanges.timestamp': 1,
    })
    await casesCollection.createIndex({
      'statusChanges.caseStatus': 1,
    })
    await casesCollection.createIndex({
      'alerts.statusChanges.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.statusChanges.caseStatus': 1,
    })
    await casesCollection.createIndex({
      'lastStatusChange.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts._id': 1,
    })
    await casesCollection.createIndex({
      'alerts.lastStatusChange.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertId': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertStatus': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertStatus': 1,
    })
    await casesCollection.createIndex({
      'alerts.assignments.assigneeUserId': 1,
    })
    await casesCollection.createIndex({
      'alerts.assignments.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.priority': 1,
    })
    await casesCollection.createIndex({
      'alerts.createdTimestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.numberOfTransactionsHit': 1,
    })
    await transactionCollection.createIndex({
      arsScore: 1,
    })
    try {
      await db.createCollection(AUDITLOG_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const auditlogCollection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(tenantId)
    )
    await auditlogCollection.createIndex({ auditlogId: 1 })
    await auditlogCollection.createIndex({ timestamp: -1 })
    await auditlogCollection.createIndex({ type: 1, action: 1 })

    try {
      await db.createCollection(SIMULATION_TASK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationTaskCollection = db.collection(
      SIMULATION_TASK_COLLECTION(tenantId)
    )
    await simulationTaskCollection.createIndex({
      type: 1,
      createdAt: -1,
    })

    try {
      await db.createCollection(SIMULATION_RESULT_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationResultCollection = db.collection(
      SIMULATION_RESULT_COLLECTION(tenantId)
    )
    await simulationResultCollection.createIndex({
      taskId: 1,
    })

    try {
      await db.createCollection(ACCOUNTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }

    await db
      .collection(ACCOUNTS_COLLECTION(tenantId))
      .createIndex({ id: 1 }, { unique: true })

    try {
      await db.createCollection(KRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const krsScoresCollection = db.collection(KRS_SCORES_COLLECTION(tenantId))
    await krsScoresCollection.createIndex({
      userId: 1,
    })
    try {
      await db.createCollection(ARS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const arsScoresCollection = db.collection(ARS_SCORES_COLLECTION(tenantId))
    await arsScoresCollection.createIndex({
      transactionId: 1,
    })
    try {
      await db.createCollection(DRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const drsScoresCollection = db.collection(DRS_SCORES_COLLECTION(tenantId))
    await drsScoresCollection.createIndex({
      userId: 1,
    })

    try {
      await db.createCollection(WEBHOOK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const webhookCollection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(tenantId)
    )
    await webhookCollection.createIndex({
      events: 1,
    })
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

  await sanctionsSearchesCollection.createIndex({
    createdAt: 1,
  })

  try {
    await db.createCollection(NARRATIVE_TEMPLATE_COLLECTION(tenantId))
  } catch (e) {
    // ignore already exists
  }

  const narrativeTemplateCollection = db.collection(
    NARRATIVE_TEMPLATE_COLLECTION(tenantId)
  )

  await narrativeTemplateCollection.createIndex({
    id: 1,
  })
  await narrativeTemplateCollection.createIndex({
    name: 1,
  })
  await narrativeTemplateCollection.createIndex({
    description: 1,
  })
  await narrativeTemplateCollection.createIndex({
    createdAt: 1,
  })

  try {
    await db.createCollection(DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId))
  } catch (e) {
    // ignore already exists
  }

  try {
    await db.createCollection(DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId))
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
