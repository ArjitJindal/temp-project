import AWS from 'aws-sdk'
import { MongoClient } from 'mongodb'
import { getConfig } from './config'

export async function getDynamoDbClient() {
  const config = getConfig()
  return new AWS.DynamoDB.DocumentClient({
    endpoint: process.env.ENV === 'local' ? 'http://localhost:8000' : undefined,
    credentials: new AWS.SharedIniFileCredentials({
      profile: `AWSAdministratorAccess-${config.env.account}`,
    }),
    region: config.env.region,
  })
}

export async function getMongoDbClient(database: string) {
  if (!process.env.MONGO_URL) {
    throw new Error('Env var missing: MONGO_URL')
  }
  const mongoUrl = process.env.MONGO_URL as string
  return await MongoClient.connect(
    `${mongoUrl}${mongoUrl[mongoUrl.length - 1] === '/' ? '' : '/'}${database}`
  )
}
