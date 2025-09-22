import { compose } from './compose'
import { apiContextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'
import { initSentryLambda } from './init-sentry-lambda'
import { registerUnhandledErrorHandler } from './lambda-utils'
import { requestLoggerMiddleware } from './request-logger'
import { Feature } from '@/@types/openapi-internal/Feature'
import { xrayMiddleware } from '@/core/middlewares/xray-middleware'
import { bgProcessingMiddleware } from '@/core/middlewares/bg-processing-middleware'
import { checkHeaders } from '@/core/middlewares/check-headers'
import { responseHeaderHandler } from '@/core/middlewares/response-header-handler'

export const publicLambdaApi = (options?: {
  requiredFeatures?: Feature[]
  enablePerformanceLogging?: boolean
}) => {
  registerUnhandledErrorHandler()
  const middlewares = [
    localDev(),
    apiContextProvider(),
    xrayMiddleware(),
    bgProcessingMiddleware(),
    responseHeaderHandler(),
    httpErrorHandler(),
    requestLoggerMiddleware(),
    // re-enable it if we want any custom reporting to be added
    // performanceLoggerMiddleware(undefined, options?.enablePerformanceLogging),
    jsonSerializer(),
    initSentryLambda(),
    checkHeaders(),
    featureProtected(options?.requiredFeatures),
  ] as const
  return compose(...middlewares)
}
