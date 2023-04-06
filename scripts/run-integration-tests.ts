import { v4 as uuidv4 } from 'uuid'
import newman from 'newman'
import { Collection } from 'postman-collection'
import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway'
import PostmanCollection from '../test-resources/public-api-transactions-tests.postman_collection.json'
import { getConfig, loadConfigEnv } from './migrations/utils/config'

loadConfigEnv()

const config = getConfig()

async function main() {
  let apiKey: string
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

      apiKey = usagePlanResponse.value as unknown as string
    } catch (e) {
      throw new Error('Failed to get usage plan key')
    }
  } else {
    throw new Error(
      'Missing required environment variables INTEGRATION_TEST_API_KEY_ID'
    )
  }

  const transactionId = uuidv4()
  const domain: string =
    process.env.DOMAIN ?? config.application.AUTH0_AUDIENCE.slice(0, -1)
  const userId = uuidv4()

  newman.run(
    {
      collection: new Collection(PostmanCollection),
      reporters: 'cli',
      globalVar: [
        { key: 'transactionId', value: transactionId },
        { key: 'apiKey', value: apiKey },
        { key: 'timestamp', value: `${Date.now()}` },
        {
          key: 'domain',
          value: domain,
        },
        { key: 'userId', value: userId },
        {
          key: 'incorrectDomain',
          value:
            config.stage === 'dev'
              ? 'https://sandbox.api.flagright.com'
              : 'https://api.flagright.dev',
        },
      ],
    },
    (err, result) => {
      if (err) {
        throw err
      }
      if (result.run.failures.length > 0) {
        throw new Error(
          `There were ${result.run.failures.length} test failures`
        )
      }
    }
  )
}

main()
