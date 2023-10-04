import { AsyncLocalStorage } from 'async_hooks'
import * as Sentry from '@sentry/serverless'
import { utils } from 'aws-xray-sdk-core'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context as LambdaContext,
} from 'aws-lambda'

import {
  CloudWatchClient,
  MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { Credentials } from '@aws-sdk/client-sts'
import { cloneDeep, isNil, omitBy } from 'lodash'
import { logger, winstonLogger } from '../logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Account } from '@/@types/openapi-internal/Account'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Metric } from '@/core/cloudwatch/metrics'
import { Permission } from '@/@types/openapi-internal/Permission'

type LogMetaData = {
  tenantId?: string
  tenantName?: string
}
export type ContextUser =
  | (Pick<Account, 'id' | 'role'> & { email?: string })
  | undefined

export type Context = LogMetaData & {
  requestId?: string
  features?: Feature[]
  logMetadata?: { [key: string]: string | undefined }
  metricDimensions?: { [key: string]: string | undefined }
  metrics?: { [namespace: string]: MetricDatum[] }
  dynamoDbClients?: DynamoDBClient[]
  user?: ContextUser
  authz?: {
    tenantId: string
    permissions: Map<Permission, boolean>
  }
  lastError?: Error
  promises?: Promise<any>[]
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()
type APIGatewayEvent = APIGatewayProxyWithLambdaAuthorizerEvent<
  APIGatewayEventLambdaAuthorizerContext<
    Partial<Credentials & JWTAuthorizerResult>
  >
>

export async function getInitialContext(
  event: unknown,
  lambdaContext: LambdaContext
): Promise<Context> {
  try {
    let features: any = undefined
    const {
      principalId: tenantId,
      tenantName,
      verifiedEmail,
      userId,
      role,
      encodedPermissions,
    } = (event as APIGatewayEvent)?.requestContext?.authorizer || {}

    if (tenantId) {
      const dynamoDb = getDynamoDbClientByEvent(
        event as APIGatewayProxyWithLambdaAuthorizerEvent<
          APIGatewayEventLambdaAuthorizerContext<Credentials>
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

    const trace = utils.processTraceData(process.env._X_AMZN_TRACE_ID)

    const context: Context = {
      tenantId,
      tenantName,
      requestId: (event as APIGatewayEvent).requestContext?.requestId,
      logMetadata: {
        tenantId,
        tenantName,
        functionName: lambdaContext?.functionName,
        region: process.env.AWS_REGION,
        requestId: lambdaContext.awsRequestId,
        traceId: trace.sampled === '1' ? trace.root : undefined,
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
            role: role!,
          }
        : undefined,
    }
    return context
  } catch (e) {
    if (process.env.ENV !== 'local') {
      winstonLogger.error(
        `Failed to initialize context: ${(e as Error)?.message}`,
        e
      )
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
    context.logMetadata = omitBy(
      {
        ...context.logMetadata,
        ...addedMetadata,
      },
      isNil
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

export async function publishContextMetrics() {
  // Publish metrics for each namespace to cloudwatch
  try {
    const client = new CloudWatchClient({
      region: process.env.AWS_REGION,
    })
    const metrics = getContext()?.metrics
    if (metrics) {
      await Promise.all(
        Object.keys(metrics).map((ns) => {
          return client.send(
            new PutMetricDataCommand({
              Namespace: ns,
              MetricData: metrics[ns],
            })
          )
        })
      )
    }
  } catch (err) {
    logger.warn(`Error sending metrics`, err)
  }
}

export async function withContext<R>(
  callback: () => Promise<R>,
  context?: Context
): Promise<R> {
  const ctx = context ?? getContext() ?? {}
  return getContextStorage().run(cloneDeep(ctx), async () => {
    const response = await callback()
    await publishContextMetrics()
    return response
  })
}

export function getContextStorage(): AsyncLocalStorage<Context> {
  return asyncLocalStorage
}

export function getContext(): Context | undefined {
  return asyncLocalStorage.getStore()
}

export function currentUser(): ContextUser {
  return getContext()?.user
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
