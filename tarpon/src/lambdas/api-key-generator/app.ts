import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  getMongoDbClient,
  createMongoDBCollections,
} from '@/utils/mongodb-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { createNewApiKeyForTenant } from '@/services/api-key'
import { getFullTenantId } from '@/utils/tenant'
import { envIs } from '@/utils/env'

export type ApiKeyGeneratorQueryStringParameters = {
  tenantId: string
  usagePlanId: string
  demoTenant: string
}

export const apiKeyGeneratorHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { tenantId, usagePlanId, demoTenant } =
      event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
    const mongoClient = await getMongoDbClient()
    const isDemo = demoTenant === 'true' && envIs('sandbox')
    const fullTenantId = getFullTenantId(tenantId, isDemo)
    const dynamoDb = getDynamoDbClient()
    await createMongoDBCollections(mongoClient, dynamoDb, fullTenantId)
    if (isDemo) {
      const dynamoDb = await getDynamoDbClient()
      const tenantRepository = new TenantRepository(fullTenantId, { dynamoDb })
      await tenantRepository.createOrUpdateTenantSettings({
        features: ['DEMO_MODE'],
      })
      await sendBatchJobCommand({
        type: 'DEMO_MODE_DATA_LOAD',
        tenantId: fullTenantId,
        awsCredentials: getCredentialsFromEvent(event),
      })
    }
    return createNewApiKeyForTenant(fullTenantId, usagePlanId)
  }
)
