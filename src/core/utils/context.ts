import { AsyncLocalStorage } from 'async_hooks'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

type Context = {
  features?: Feature[]
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export async function getInitialContext(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
): Promise<Context> {
  try {
    const tenantId = event.requestContext.authorizer?.principalId
    const dynamoDb = getDynamoDbClient(event)
    const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
    const settings = await tenantRepository.getTenantSettings(['features'])
    return { features: settings?.features }
  } catch (e) {
    console.error(`Failed to initialize context`)
    return {}
  }
}

export function getContextStorage(): AsyncLocalStorage<Context> {
  return asyncLocalStorage
}

export function getContext(): Context | undefined {
  return asyncLocalStorage.getStore()
}

export function hasFeature(feature: Feature): boolean {
  return getContext()?.features?.includes(feature) || false
}
