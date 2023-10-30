import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway'
import { memoize } from 'lodash'
import { getConfig } from '../../../scripts/migrations/utils/config'

export async function fetchApiKey(): Promise<string> {
  const config = getConfig()

  if (process.env.API_KEY) {
    return process.env.API_KEY as string
  }

  const flagrightTenantApiKeyId = config.application.INTEGRATION_TEST_API_KEY_ID

  const apiGateway = new APIGatewayClient({
    region: config.env.region,
  })

  const command = new GetApiKeyCommand({
    apiKey: flagrightTenantApiKeyId,
    includeValue: true,
  })

  if (flagrightTenantApiKeyId) {
    try {
      const usagePlanResponse = await apiGateway.send(command)

      if (!usagePlanResponse.value) {
        throw new Error('Missing usage plan key')
      }

      return usagePlanResponse.value as unknown as string
    } catch (e) {
      console.log(e)
      throw new Error('Failed to get usage plan key')
    }
  } else {
    throw new Error(
      'Missing required environment variables INTEGRATION_TEST_API_KEY_ID'
    )
  }
}

export const getApiKey: () => Promise<string> = memoize(fetchApiKey)
