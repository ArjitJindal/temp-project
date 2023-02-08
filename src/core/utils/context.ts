import { AsyncLocalStorage } from 'async_hooks'
import * as Sentry from '@sentry/serverless'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context as LambdaContext,
} from 'aws-lambda'
import _ from 'lodash'
import { MetricDatum } from '@aws-sdk/client-cloudwatch'
import { winstonLogger } from '../logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Account } from '@/@types/openapi-internal/Account'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { AccountRoleName } from '@/@types/openapi-internal/AccountRoleName'
import { Metric } from '@/core/cloudwatch/metrics'

type LogMetaData = {
  tenantId?: string
}

type Context = LogMetaData & {
  features?: Feature[]
  logMetadata?: { [key: string]: string | undefined }
  metricDimensions?: { [key: string]: string | undefined }
  metrics?: { [namespace: string]: MetricDatum[] }
  user?: Partial<Account>
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export async function getInitialContext(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<
      AWS.STS.Credentials & JWTAuthorizerResult
    >
  >,
  lambdaContext: LambdaContext
): Promise<Context> {
  try {
    let features = undefined
    const {
      principalId: tenantId,
      verifiedEmail,
      userId,
      role,
    } = event.requestContext?.authorizer || {}
    if (tenantId) {
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      features = (await tenantRepository.getTenantSettings(['features']))
        ?.features
    }
    const context: Context = {
      logMetadata: {
        tenantId,
        functionName: lambdaContext?.functionName,
        region: process.env.AWS_REGION,
      },
      metrics: {},
      metricDimensions: {
        tenantId,
        functionName: lambdaContext?.functionName,
      },
      features,
      user: userId
        ? {
            id: userId,
            email: verifiedEmail,
            role: role as AccountRoleName,
          }
        : undefined,
    }
    return context
  } catch (e) {
    if (process.env.ENV !== 'local') {
      winstonLogger.error(`Failed to initialize context`)
    }
    return {}
  }
}

export function updateLogMetadata(addedMetadata: { [key: string]: any }) {
  const context = asyncLocalStorage.getStore()
  if (context) {
    context.logMetadata = _.omitBy(
      {
        ...context.logMetadata,
        ...addedMetadata,
      },
      _.isNil
    )
    Sentry.setTags(context.logMetadata)
  }
}

export function publishMetric(
  metric: Metric,
  value: number,
  dimensions?: { [key: string]: string }
) {
  const context = asyncLocalStorage.getStore()
  if (!context) {
    return
  }
  const dimensionsWithContext = {
    ...context.metricDimensions,
    ...dimensions,
  }
  const metricDatum = {
    MetricName: metric.name,
    Dimensions: Object.entries(dimensionsWithContext || {})
      // Lambda function name isn't defined in local dev.
      .filter((entry) => entry[1] !== undefined)
      .map((entry) => ({
        Name: entry[0],
        Value: entry[1],
      })),
    Unit: 'None',
    Value: value,
    Timestamp: new Date(),
  }

  if (context.metrics == undefined) {
    context.metrics = {}
  }
  context.metrics[metric.namespace] = [
    metricDatum,
    ...(context.metrics[metric.namespace] || []),
  ]
}

export function getContextStorage(): AsyncLocalStorage<Context> {
  return asyncLocalStorage
}

export function getContext(): Context | undefined {
  return asyncLocalStorage.getStore()
}

export function hasFeature(feature: Feature): boolean {
  return (
    getContext()?.features?.includes(feature) ||
    getTestEnabledFeatures()?.includes(feature) ||
    false
  )
}

export function hasFeatures(features: Feature[]): boolean {
  return (
    features.every((feature) => hasFeature(feature)) ||
    getTestEnabledFeatures()?.some((feature) => features.includes(feature)) ||
    false
  )
}

export function getTestEnabledFeatures(): Feature[] | undefined {
  return process.env.ENV === 'local'
    ? (process.env.TEST_ENABLED_FEATURES?.split(',') as Feature[])
    : undefined
}
