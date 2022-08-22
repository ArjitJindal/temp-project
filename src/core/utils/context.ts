import { AsyncLocalStorage } from 'async_hooks'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Logger } from 'winston'
import { winstonLogger } from '../logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

type LogMetaData = {
  tenantId?: string
}

type Context = LogMetaData & {
  features?: Feature[]
  logger?: Logger
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
    const logMetaData: LogMetaData = { tenantId: tenantId }
    const childLogger = winstonLogger.child(logMetaData)
    const context: Context = {
      ...logMetaData,
      features: settings?.features,
      logger: childLogger,
    }
    return context
  } catch (e) {
    winstonLogger.error(`Failed to initialize context`)
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
