import { Document, Long } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  ARS_SCORES_COLLECTION,
  AUDITLOG_COLLECTION,
  CASES_COLLECTION,
  COUNTER_COLLECTION,
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DRS_SCORES_COLLECTION,
  DRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
  getMongoDbClient,
  IMPORT_COLLECTION,
  KRS_SCORES_COLLECTION,
  METADATA_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USER_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { getErrorMessage } from '@/utils/lang'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { getS3Client } from '@/utils/s3'

export class DemoModeDataLoadJobRunner implements BatchJobRunner {
  public async run(job: DemoModeDataLoadBatchJob) {
    const { tenantId, awsCredentials } = job
    const s3 = getS3Client(awsCredentials)
    const mongoClient = await getMongoDbClient()
    console.log('Generate collections names and S3 keys')
    const keys = getCollectionToS3KeyMap(tenantId)
    const db = mongoClient.db()
    for (const [collection, fileKey] of Object.entries(keys)) {
      console.log(`Fetch "${fileKey}" file`)
      const documents = await getCollectionDocuments(
        s3,
        tenantId,
        collection,
        fileKey
      )
      console.log(`Populate "${collection}" collection`)
      await db.collection(collection).insertMany(documents)
    }
    console.log('Done')
    await mongoClient.close()
  }
}

function getCollectionToS3KeyMap(tenantId: string) {
  return {
    [ARS_SCORES_COLLECTION(tenantId)]: 'flagright-action-risk-values.json',
    [AUDITLOG_COLLECTION(tenantId)]: 'flagright-auditlog.json',
    [CASES_COLLECTION(tenantId)]: 'flagright-cases.json',
    [COUNTER_COLLECTION(tenantId)]: 'flagright-counter.json',
    [DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)]:
      'flagright-dashboard-hits-by-user-stats-hourly.json',
    [DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)]:
      'flagright-dashboard-rule-stats-hourly.json',
    [DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)]:
      'flagright-dashboard-transaction-stats-daily.json',
    [DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)]:
      'flagright-dashboard-transaction-stats-hourly.json',
    [DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)]:
      'flagright-dashboard-transaction-stats-monthly.json',
    [DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenantId)]:
      'flagright-drs-scores-distribution.json',
    [DRS_SCORES_COLLECTION(tenantId)]: 'flagright-dynamic-risk-values.json',
    [IMPORT_COLLECTION(tenantId)]: 'flagright-import.json',
    [KRS_SCORES_COLLECTION(tenantId)]: 'flagright-kyc-risk-values.json',
    [METADATA_COLLECTION(tenantId)]: 'flagright-metadata.json',
    [SANCTIONS_SEARCHES_COLLECTION(tenantId)]:
      'flagright-sanctions-searches.json',
    [TRANSACTION_EVENTS_COLLECTION(tenantId)]:
      'flagright-transaction-events.json',
    [TRANSACTIONS_COLLECTION(tenantId)]: 'flagright-transactions.json',
    [USER_EVENTS_COLLECTION(tenantId)]: 'flagright-user-events.json',
    [USERS_COLLECTION(tenantId)]: 'flagright-users.json',
  }
}

async function getCollectionDocuments(
  s3: AWS.S3,
  tenantId: string,
  collection: string,
  fileKey: string
): Promise<Document[]> {
  let file
  try {
    file = await s3
      .getObject({
        Bucket: StackConstants.S3_DEMO_MODE_BUCKET_NAME,
        Key: fileKey,
      })
      .promise()
  } catch (e) {
    throw new Error(`Unable to fetch file "${fileKey}". ${getErrorMessage(e)}`)
  }

  const body = file.Body
  if (body == null) {
    throw new Error(
      `Unable to read file by key "${fileKey}" (S3 response is empty)`
    )
  }
  let json
  try {
    json = JSON.parse(body.toString())
  } catch (e) {
    throw new Error(
      `Unable to parse JSON from file "${fileKey}". ${getErrorMessage(e)}`
    )
  }

  const result = (json as Document[]).map(({ _id, ...document }) =>
    replaceLongs(document)
  ) as Document[]
  return result
}

function replaceLongs(value: unknown): unknown {
  if (
    value == null ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((x) => replaceLongs(x))
  }
  if (typeof value !== 'object') {
    throw new Error(`Wrong value: ${value}`)
  }
  const obj = value as Record<string, unknown>
  if (typeof obj['$numberLong'] === 'string') {
    return Long.fromString(obj['$numberLong'])
  }
  return Object.entries(obj).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: replaceLongs(value),
    }),
    {}
  )
}
