import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { APIGateway } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import {
  connectToDB,
  DASHBOARD_TIMESERIES_COLLECTION,
  TRANSACIONS_COLLECTION,
  USERS_COLLECTION,
} from '../../utils/docDBUtils'
import { TarponStackConstants } from '../../../lib/constants'

import { compose } from '../../core/middlewares/compose'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'

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

export const createDocumentDBCollections = async (tenantId: string) => {
  client = await connectToDB()
  const db = client.db(TarponStackConstants.DOCUMENT_DB_DATABASE_NAME)
  try {
    await db.createCollection(TRANSACIONS_COLLECTION(tenantId))
    await db.createCollection(USERS_COLLECTION(tenantId))
  } catch (e) {
    console.log(`Error in creating DocumentDB collections: ${e}`)
  }
}
export const apiKeyGeneratorHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { tenantId, usagePlanId } =
      event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
    await createDocumentDBCollections(tenantId)
    return createNewApiKeyForTenant(tenantId, usagePlanId)
  }
)
