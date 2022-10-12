import { AsyncLocalStorage } from 'async_hooks'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context as LambdaContext,
} from 'aws-lambda'
import { winstonLogger } from '../logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

type LogMetaData = {
  tenantId?: string
  entityDetails?: { [key: string]: string | undefined }
}

type Context = LogMetaData & {
  features?: Feature[]
  logMetaData?: { [key: string]: string }
  metricDimensions?: { [key: string]: string | undefined }
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export async function getInitialContext(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >,
  lambdaContext: LambdaContext
): Promise<Context> {
  try {
    const tenantId = event.requestContext.authorizer?.principalId
    const dynamoDb = getDynamoDbClientByEvent(event)
    const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
    const settings = await tenantRepository.getTenantSettings(['features'])
    const context: Context = {
      logMetaData: {
        tenantId: tenantId,
        functionName: lambdaContext?.functionName,
      },
      metricDimensions: {
        tenantId: tenantId,
        functionName: lambdaContext?.functionName,
      },
      features: settings?.features,
    }
    return context
  } catch (e) {
    winstonLogger.error(`Failed to initialize context`)
    return {}
  }
}

export function updateLogMetadataEntityDetails(key: string, value?: string) {
  const context = asyncLocalStorage.getStore()
  if (context && context.logMetaData) {
    context.logMetaData.entityDetails = Object.create(
      context.entityDetails ? context.entityDetails : null
    )
    context.entityDetails![key] = value
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
