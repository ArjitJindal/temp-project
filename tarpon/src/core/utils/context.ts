import { AsyncLocalStorage } from 'async_hooks'
import * as Sentry from '@sentry/serverless'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context as LambdaContext,
} from 'aws-lambda'
import _ from 'lodash'
import { MetricDatum } from '@aws-sdk/client-cloudwatch'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { winstonLogger } from '../logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

import { Account } from '@/@types/openapi-internal/Account'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Metric } from '@/core/cloudwatch/metrics'
import { Permission } from '@/@types/openapi-internal/Permission'

type LogMetaData = {
  tenantId?: string
}

export type Context = LogMetaData & {
  features?: Feature[]
  logMetadata?: { [key: string]: string | undefined }
  metricDimensions?: { [key: string]: string | undefined }
  metrics?: { [namespace: string]: MetricDatum[] }
  dynamoDbClients?: DynamoDBClient[]
  user?: Partial<Account>
  authz?: {
    tenantId: string
    permissions: Map<Permission, boolean>
  }
  lastError?: Error
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export async function getInitialContext(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<
      Partial<AWS.STS.Credentials & JWTAuthorizerResult>
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
      encodedPermissions,
    } = event.requestContext?.authorizer || {}

    if (tenantId) {
      const dynamoDb = getDynamoDbClientByEvent(
        event as APIGatewayProxyWithLambdaAuthorizerEvent<
          APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
        >
      )
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      features = (await tenantRepository.getTenantSettings(['features']))
        ?.features
    }

    // Create a map for O(1) lookup in permissions checks
    const permissions = new Map<Permission, boolean>()
    encodedPermissions
      ?.split(',')
      .forEach((p) => permissions.set(p as Permission, true))

    const context: Context = {
      tenantId,
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
      authz: {
        tenantId,
        permissions,
      },
      user: userId
        ? {
            id: userId,
            email: verifiedEmail,
            role,
          }
        : undefined,
    }
    return context
  } catch (e) {
    if (process.env.ENV !== 'local') {
      winstonLogger.error(`Failed to initialize context`, e)
    }
    return {}
  }
}

export async function initializeTenantContext(tenantId: string) {
  const context = getContext()
  if (!context) {
    throw new Error('Cannot get context')
  }
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
  const features = (await tenantRepository.getTenantSettings(['features']))
    ?.features
  context.tenantId = tenantId
  if (!context.logMetadata) {
    context.logMetadata = {}
  }
  if (!context.metricDimensions) {
    context.metricDimensions = {}
  }
  context.logMetadata.tenantId = tenantId
  context.metricDimensions.tenantId = tenantId
  context.features = features
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
