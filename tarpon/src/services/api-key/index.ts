import { v4 as uuidv4 } from 'uuid'
import {
  APIGateway,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
} from '@aws-sdk/client-api-gateway'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base62 = require('base-x')(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

function createUuid() {
  return uuidv4().replace(/-/g, '')
}

export function createNewApiKey(tenantId: string) {
  return base62.encode(
    Buffer.from(`${tenantId}.${createUuid()}${createUuid()}`)
  )
}

export async function createNewApiKeyForTenant(
  tenantId: string,
  usagePlanId: string
): Promise<{ newApiKey: string; apiKeyId: string }> {
  // TODO: Verify tenantId exists (in DB and Usage Plan)
  const newApiKey = createNewApiKey(tenantId)
  const apiGateway = new APIGateway({
    region: process.env.AWS_REGION,
  })
  const createApiKeyCommand = new CreateApiKeyCommand({
    enabled: true,
    name: tenantId, // TODO: concat with user ID
    value: newApiKey,
  })

  const apiKeyResult = await apiGateway.send(createApiKeyCommand)
  const createUsagePlanCommand = new CreateUsagePlanKeyCommand({
    usagePlanId,
    keyId: apiKeyResult.id as string,
    keyType: 'API_KEY',
  })

  await apiGateway.send(createUsagePlanCommand)

  return { newApiKey, apiKeyId: apiKeyResult.id as string }
}
