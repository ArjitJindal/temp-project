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
import { rbacMiddleware } from '@/core/middlewares/rbac'
import { xrayMiddleware } from '@/core/middlewares/xray-middleware'
import { bgProcessingMiddleware } from '@/core/middlewares/bg-processing-middleware'
import { checkHeaders } from '@/core/middlewares/check-headers'
import { corsHandler } from '@/core/middlewares/cors-handler'

export const lambdaApi = (options?: { requiredFeatures?: Feature[] }) => {
  registerUnhandledErrorHandler()
  const middlewares = [
    localDev(),
    apiContextProvider(),
    xrayMiddleware(),
    bgProcessingMiddleware(),
    corsHandler(),
    httpErrorHandler(),
    requestLoggerMiddleware(),
    jsonSerializer(),
    rbacMiddleware(),
    initSentryLambda(),
    checkHeaders(),
    featureProtected(options?.requiredFeatures),
  ] as const
  return compose(...middlewares)
}
