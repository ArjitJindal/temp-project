import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  getMongoDbClient,
  createMongoDBCollections,
} from '@/utils/mongoDBUtils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { sendBatchJobCommand } from '@/services/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { getFullTenantId } from '@/lambdas/jwt-authorizer/app'
import { createNewApiKeyForTenant } from '@/services/api-key'

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
    const isDemo = demoTenant === 'true' && process.env.ENV === 'sandbox'
    const fullTenantId = getFullTenantId(tenantId, isDemo)
    await createMongoDBCollections(mongoClient, fullTenantId)
    if (isDemo) {
      const dynamoDb = await getDynamoDbClient()
      const tenantRepository = new TenantRepository(fullTenantId, { dynamoDb })
      await tenantRepository.createOrUpdateTenantSettings({
        features: ['DEMO_MODE'],
      })
      const batchJob: DemoModeDataLoadBatchJob = {
        type: 'DEMO_MODE_DATA_LOAD',
        tenantId: fullTenantId,
        awsCredentials: getCredentialsFromEvent(event),
      }
      await sendBatchJobCommand(fullTenantId, batchJob)
    }
    return createNewApiKeyForTenant(fullTenantId, usagePlanId)
  }
)
