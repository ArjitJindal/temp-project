import { compose } from './compose'
import { contextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'
import { initSentry } from './init-sentry'
import { metricsMiddleware } from './metrics-middleware'
import { resourceCleanupHandler } from './resource-cleanup-handler'
import { Feature } from '@/@types/openapi-internal/Feature'
import { rbacMiddleware } from '@/core/middlewares/rbac'
import { xrayMiddleware } from '@/core/middlewares/xray-middleware'
import { bgProcessingMiddleware } from '@/core/middlewares/bg-processing-middleware'

export const lambdaApi = (options?: { requiredFeatures?: Feature[] }) => {
  const middlewares = [
    localDev(),
    xrayMiddleware(),
    bgProcessingMiddleware(),
    httpErrorHandler(),
    jsonSerializer(),
    contextProvider(),
    rbacMiddleware(),
    initSentry(),
    featureProtected(options?.requiredFeatures),
    metricsMiddleware(),
    resourceCleanupHandler(),
  ] as const
  return compose(...middlewares)
}
