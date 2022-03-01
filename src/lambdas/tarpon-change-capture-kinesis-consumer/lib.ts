import { MongoClient, Db } from 'mongodb'
import { readFileSync } from 'fs'
const AWS = require('aws-sdk')

interface DBCredentials {
  username: string
  password: string
}

const secretsmanager = new AWS.SecretsManager()
const DB_HOST = process.env.DB_HOST as string
const DB_PORT = process.env.DB_PORT as string
const SM_SECRET_ARN = process.env.SM_SECRET_ARN as string
const ca = readFileSync(`${__dirname}/rds-combined-ca-bundle.pem`)

let cacheClient: MongoClient

export async function connectToDB() {
  if (cacheClient) {
    return cacheClient
  }
  const credentials = await getCredentials()
  const DB_USERNAME = credentials['username']
  const DB_PASSWORD = credentials['password']
  const DB_URL = `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}`
  cacheClient = await MongoClient.connect(DB_URL as string, {
    ssl: true,
    sslValidate: true,
    sslCA: ca.toString(),
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
