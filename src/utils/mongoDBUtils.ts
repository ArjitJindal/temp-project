import os from 'os'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

interface DBCredentials {
  username: string
  password: string
  host: string
}

const secretsmanager = new SecretsManagerClient({
  endpoint: process.env.ENV === 'local' ? 'https://0.0.0.0:4566' : undefined,
  region: process.env.AWS_REGION,
})
const SM_SECRET_ARN = process.env.SM_SECRET_ARN as string

let cacheClient: MongoClient

export async function getMongoDbClient(
  dbName = StackConstants.MONGO_DB_DATABASE_NAME
) {
  if (cacheClient) {
    return cacheClient
  }
  if (process.env.NODE_ENV === 'test') {
    return await MongoClient.connect(
      process.env.MONGO_URI || `mongodb://localhost:27017/${dbName}`
    )
  }
  if (process.env.ENV === 'local') {
    return await MongoClient.connect(
      process.env.MONGO_URI ||
        `mongodb://${
          os.type() === 'Linux' ? '172.17.0.1' : 'host.docker.internal'
        }:27017/${dbName}`
    )
  }

  const credentials = await getCredentials()
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

async function getCredentials(): Promise<DBCredentials> {
  const secretsResponse = await secretsmanager.send(
    new GetSecretValueCommand({
      SecretId: SM_SECRET_ARN,
    })
  )
  return JSON.parse(secretsResponse.SecretString as string)
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

export const MONTH_DATE_FORMAT = '%Y-%m'
export const DAY_DATE_FORMAT = '%Y-%m-%d'
export const HOUR_DATE_FORMAT = '%Y-%m-%dT%H'

export const MONTH_DATE_FORMAT_JS = 'YYYY-MM'
export const DAY_DATE_FORMAT_JS = 'YYYY-MM-DD'
export const HOUR_DATE_FORMAT_JS = 'YYYY-MM-DD[T]HH'
