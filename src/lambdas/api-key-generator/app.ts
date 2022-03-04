import { APIGatewayProxyHandler } from 'aws-lambda'
import { APIGateway } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { connectToDB, success, notFound } from '../../utils/documentUtils'

let client: MongoClient

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base62 = require('base-x')(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

export type ApiKeyGeneratorQueryStringParameters = {
  tenantId: string
  usagePlanId: string
}

function createUuid() {
  return uuidv4().replace(/-/g, '')
}

function createNewApiKey(tenantId: string) {
  return base62.encode(
    Buffer.from(`${tenantId}.${createUuid()}${createUuid()}`)
  )
}

async function createNewApiKeyForTenant(
  tenantId: string,
  usagePlanId: string
): Promise<string> {
  // TODO: Verify tenantId exists (in DB and Usage Plan)
  const newApiKey = createNewApiKey(tenantId)
  const apiGateway = new APIGateway()
  const apiKeyResult = await apiGateway
    .createApiKey({
      enabled: true,
      name: tenantId, // TODO: concat with user ID
      value: newApiKey,
    })
    .promise()
  await apiGateway
    .createUsagePlanKey({
      usagePlanId,
      keyId: apiKeyResult.id as string,
      keyType: 'API_KEY',
    })
    .promise()
  return newApiKey
}

export const apiKeyGeneratorHandler: APIGatewayProxyHandler = async (event) => {
  const { tenantId, usagePlanId } =
    event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
  const newApiKey = await createNewApiKeyForTenant(tenantId, usagePlanId)
  await createDocumentDBCollections(tenantId)

  return {
    statusCode: 200,
    body: newApiKey,
  }
}

export const createDocumentDBCollections = async (tenantId: string) => {
  client = await connectToDB()
  const db = client.db('tarpon')
  try {
    await db.createCollection(`${tenantId}-transactions`)
    await db.createCollection(`${tenantId}-users`)
    await db.createCollection(`${tenantId}-dashboard`)
  } catch (e) {
    console.log(`Error in creating DocumentDB collections: ${e}`)
  }
}
