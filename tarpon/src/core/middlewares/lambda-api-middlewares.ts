import { compose } from './compose'
import { apiContextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { initSentryLambda } from './init-sentry-lambda'
import { registerUnhandledErrorHandler } from './lambda-utils'
import { requestLoggerMiddleware } from './request-logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { rbacMiddleware } from '@/core/middlewares/rbac'
import { xrayMiddleware } from '@/core/middlewares/xray-middleware'
import { bgProcessingMiddleware } from '@/core/middlewares/bg-processing-middleware'
import { checkHeaders } from '@/core/middlewares/check-headers'
import { responseHeaderHandler } from '@/core/middlewares/response-header-handler'
import { createLazyLocalDev } from '@/core/middlewares/lazy-local-dev'

export const lambdaApi = (options?: {
  requiredFeatures?: Feature[]
  enablePerformanceLogging?: boolean
}) => {
  registerUnhandledErrorHandler()

  const middlewares = [
    createLazyLocalDev(),
    apiContextProvider(),
    xrayMiddleware(),
    bgProcessingMiddleware(),
    responseHeaderHandler(),
    httpErrorHandler(),
    requestLoggerMiddleware(),
    // re-enable it if we want any custom reporting to be added
    // performanceLoggerMiddleware(undefined, options?.enablePerformanceLogging),
    jsonSerializer(),
    rbacMiddleware(),
    initSentryLambda(),
    checkHeaders(),
    featureProtected(options?.requiredFeatures),
  ] as const
  return compose(...middlewares)
}
