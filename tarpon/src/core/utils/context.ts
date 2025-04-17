import * as Sentry from '@sentry/serverless'
import { Extras } from '@sentry/types/types/extra'
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
import { isEmpty, isNil, mergeWith, omitBy } from 'lodash'
import { logger, winstonLogger } from '../logger'
import { DEFAULT_ROLES_V2 } from '../default-roles'
import { getContext, getContextStorage } from './context-storage'
import { Feature } from '@/@types/openapi-internal/Feature'
import {
  cleanUpDynamoDbResources,
  getDynamoDbClient,
  getDynamoDbClientByEvent,
} from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Account } from '@/@types/openapi-internal/Account'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Metric } from '@/core/cloudwatch/metrics'
import { Permission } from '@/@types/openapi-internal/Permission'
import { envIs } from '@/utils/env'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { getDefaultTimezone, Timezone } from '@/utils/dayjs'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { DynamoRolesRepository } from '@/services/roles/repository/dynamo'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'

type LogMetaData = {
  tenantId?: string
  tenantName?: string
}
export type ContextUser =
  | (Pick<Account, 'id' | 'role' | 'allowTenantDeletion' | 'allowedRegions'> & {
      email?: string
    })
  | undefined

export type Context = LogMetaData & {
  requestId?: string
  rawTraceId?: string
  settings?: TenantSettings
  features?: Feature[]
  riskClassificationValues?: RiskClassificationScore[]
  logMetadata?: { [key: string]: string | undefined }
  metricDimensions?: { [key: string]: string | undefined }
  metrics?: { [namespace: string]: MetricDatum[] }
  dynamoDbClients?: DynamoDBClient[]
  user?: ContextUser
  statements?: PermissionStatements[]
  authz?: {
    tenantId: string
    permissions: Map<Permission, boolean>
  }
  lastError?: Error
  promises?: Promise<any>[]
  sentryExtras?: { [key: string]: unknown }
  auth0Domain?: string
}

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
    let features: Feature[] | undefined
    let settings: TenantSettings | undefined
    const {
      principalId: tenantId,
      tenantName,
      verifiedEmail,
      userId,
      role,
      encodedPermissions,
      allowTenantDeletion,
      encodedAllowedRegions,
      auth0Domain,
    } = (event as APIGatewayEvent)?.requestContext?.authorizer || {}

    if (tenantId) {
      const dynamoDb = getDynamoDbClientByEvent(
        event as APIGatewayProxyWithLambdaAuthorizerEvent<
          APIGatewayEventLambdaAuthorizerContext<Credentials>
        >
      )
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      const allSettings = await tenantRepository.getTenantSettings()
      features = allSettings?.features
      settings = allSettings
    }

    // Create a map for O(1) lookup in permissions checks
    const permissions = new Map<Permission, boolean>()
    encodedPermissions
      ?.split(',')
      .forEach((p) => permissions.set(p as Permission, true))

    const allowedRegions = encodedAllowedRegions?.split(',')

    const trace = utils.processTraceData(process.env._X_AMZN_TRACE_ID)

    const context: Context = {
      tenantId,
      tenantName,
      requestId: (event as APIGatewayEvent).requestContext?.requestId,
      rawTraceId: process.env._X_AMZN_TRACE_ID,
      logMetadata: {
        tenantId,
        tenantName,
        functionName: lambdaContext?.functionName,
        region: process.env.AWS_REGION,
        requestId: lambdaContext?.awsRequestId,
        traceId: trace.sampled === '1' ? trace.root : undefined,
        userId,
        verifiedEmail,
        role,
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
            role: role ?? '',
            allowTenantDeletion: Boolean(allowTenantDeletion),
            allowedRegions,
          }
        : undefined,
      settings,
      auth0Domain,
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
  const tenantSettings = await tenantRepository.getTenantSettings()
  context.tenantId = tenantId
  if (!context.logMetadata) {
    context.logMetadata = {}
  }
  if (!context.metricDimensions) {
    context.metricDimensions = {}
  }
  context.logMetadata.tenantId = tenantId
  context.metricDimensions.tenantId = tenantId
  context.features = tenantSettings?.features
  context.settings = tenantSettings ?? {}
  context.auth0Domain = tenantSettings?.auth0Domain ?? process.env.AUTH0_DOMAIN
}

export function updateLogMetadata(addedMetadata: { [key: string]: any }) {
  const context = getContext()
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

export function addSentryExtras(addedExtras: Extras) {
  const context = getContext()
  if (context) {
    context.sentryExtras = {
      ...context.sentryExtras,
      ...addedExtras,
    }
  }

  if (context?.sentryExtras) {
    Sentry.setExtras(context.sentryExtras)
  }
}

export function updateTenantFeatures(features: Feature[]) {
  const context = getContext()
  if (context) {
    context.features = features
  }
}

export function updateTenantSettings(settings: TenantSettings) {
  const context = getContext()
  if (context) {
    context.settings = settings
    context.features = settings.features ?? []
  }
}

export function updateTenantRiskClassificationValues(
  riskClassificationValues: RiskClassificationScore[]
) {
  const context = getContext()
  if (context) {
    context.riskClassificationValues = riskClassificationValues
  }
}

export function publishMetric(
  metric: Metric,
  value: number,
  dimensions?: { [key: string]: string }
) {
  const context = getContext()
  if (!context) {
    return
  }
  const dimensionsWithContext = {
    ...context.metricDimensions,
    ...dimensions,
  }
  const metricDatum: MetricDatum = {
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

export async function publishContextMetrics(context: Context | undefined) {
  if (
    envIs('local') ||
    envIs('test') ||
    !context ||
    process.env.CUSTOM_METRICS === 'false'
  ) {
    return
  }

  // Publish metrics for each namespace to cloudwatch
  try {
    const client = new CloudWatchClient({
      region: process.env.AWS_REGION,
    })
    const metrics = context.metrics
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
  const finalContext = context ?? getContext() ?? {}
  const ctx: Context = {
    ...finalContext,
    logMetadata: { ...finalContext?.logMetadata }, // type { [key: string]: string | undefined }
    metricDimensions: { ...finalContext?.metricDimensions }, // type { [key: string]: string | undefined }
    sentryExtras: { ...finalContext?.sentryExtras },
  }
  ctx.metrics = {}
  // Reset dynamodb clients from parent, then we won't clean up the dynamodb clients
  // which might still be used.
  ctx.dynamoDbClients = []

  const result = await getContextStorage().run(ctx, async () => {
    try {
      return await callback()
    } finally {
      await cleanUpDynamoDbResources()
    }
  })
  const parentContext = getContext()
  if (parentContext) {
    parentContext.metrics
    parentContext.metrics = mergeWith(
      parentContext.metrics ?? {},
      ctx.metrics ?? {},
      (m1: MetricDatum[] | undefined, m2: MetricDatum[] | undefined) =>
        (m1 ?? []).concat(m2 ?? [])
    )
  } else {
    // NOTE: we only publish metrics for the root context
    await publishContextMetrics(ctx)
  }
  return result
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

// Function for finaind tenant specific feature - to be used in global systems without context like Kinesis Consumers
// For lambdas in console API or public API, use `useFeature` from context instead
export async function tenantHasFeature(
  tenantId: string,
  feature: Feature
): Promise<boolean> {
  let features = getContext()?.features
  if (!features) {
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    features =
      (await tenantRepository.getTenantSettings(['features']))?.features ?? []
    updateTenantFeatures(features)
  }

  return (
    features?.includes(feature) ||
    getTestEnabledFeatures()?.includes(feature) ||
    false
  )
}

export async function tenantHasEitherFeatures(
  tenantId: string,
  features: Feature[]
): Promise<boolean> {
  let contextFeatures = getContext()?.features
  if (!contextFeatures) {
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    contextFeatures =
      (await tenantRepository.getTenantSettings(['features']))?.features ?? []
    updateTenantFeatures(contextFeatures)
  }

  return (
    contextFeatures?.some((feature) => features.includes(feature)) ||
    getTestEnabledFeatures()?.some((feature) => features.includes(feature)) ||
    false
  )
}

export async function tenantStatements(
  tenantId: string
): Promise<PermissionStatements[]> {
  const context = getContext()
  const contextStatements = context?.statements
  if (contextStatements && !isEmpty(contextStatements)) {
    return contextStatements
  }

  const roleRepository = new DynamoRolesRepository(
    getContext()?.auth0Domain ?? '',
    getDynamoDbClient()
  )
  const isDefaultRole = DEFAULT_ROLES_V2.find(
    (role) => role.role === context?.user?.role
  )
  const statements = await (isDefaultRole
    ? Promise.resolve(
        DEFAULT_ROLES_V2.find((role) => role.role === context?.user?.role)
          ?.permissions ?? []
      )
    : roleRepository.getRoleStatements(tenantId, context?.user?.role ?? ''))

  return statements.map((statement) => {
    return {
      ...statement,
      resources: statement.resources.map((resource) =>
        resource.replace('<default>', tenantId)
      ),
    }
  })
}

export async function tenantSettings(
  tenantId: string
): Promise<TenantSettings> {
  const contextSettings = getContext()?.settings
  if (contextSettings && !isEmpty(contextSettings)) {
    return contextSettings
  }

  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb: getDynamoDbClient(),
  })
  const settings = await tenantRepository.getTenantSettings()

  if (isEmpty(contextSettings) && settings) {
    updateTenantSettings(settings)
    updateTenantFeatures(settings.features ?? [])
  }

  return settings
}

export async function tenantTimezone(tenantId: string): Promise<Timezone> {
  return (
    (await tenantSettings(tenantId))?.defaultValues?.tenantTimezone ??
    getDefaultTimezone()
  )
}
