import { MongoClient } from 'mongodb'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk')

interface DBCredentials {
  username: string
  password: string
  host: string
}

const secretsmanager = new AWS.SecretsManager()
const SM_SECRET_ARN = process.env.SM_SECRET_ARN as string

let cacheClient: MongoClient

export async function connectToDB() {
  if (cacheClient) {
    return cacheClient
  }
  if (process.env.ENV === 'local') {
    return await MongoClient.connect(
      process.env.MONGO_URI || 'mongodb://host.docker.internal:27017'
    )
  }

  const credentials = await getCredentials()
  const DB_USERNAME = credentials['username']
  const DB_PASSWORD = encodeURIComponent(credentials['password'])
  const DB_HOST = credentials['host']
  const DB_URL = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}`
  cacheClient = await MongoClient.connect(DB_URL as string, {
    retryWrites: false,
    socketTimeoutMS: 5000000,
  })
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

async function getCredentials(): Promise<DBCredentials> {
  const smRes = await secretsmanager
    .getSecretValue({
      SecretId: SM_SECRET_ARN,
    })
    .promise()
  return JSON.parse(smRes.SecretString)
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

export const USERS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-users`
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

export const IMPORT_COLLECTION = (tenantId: string) => {
  return `${tenantId}-import`
}

export const MONTH_DATE_FORMAT = '%Y-%m'
export const DAY_DATE_FORMAT = '%Y-%m-%d'
export const HOUR_DATE_FORMAT = '%Y-%m-%dT%H'
