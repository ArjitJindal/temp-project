import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway'
import { getQaApiKeyId } from '@flagright/lib/qa'

async function main() {
  const apiKey = getQaApiKeyId()
  const apigateway = new APIGatewayClient({
    region: 'eu-central-1',
  })
  const cmd = new GetApiKeyCommand({
    apiKey,
    includeValue: true,
  })
  const key = await apigateway.send(cmd)
  console.log(key.value)
}

void main()
