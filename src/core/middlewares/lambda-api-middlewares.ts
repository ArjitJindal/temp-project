import { compose } from './compose'
import { contextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'
import { initSentry } from './init-sentry'
import { metricsMiddleware } from './metrics-middleware'
import { Feature } from '@/@types/openapi-internal/Feature'

export const lambdaApi = (options?: { requiredFeatures?: Feature[] }) => {
  const middlewares = [
    localDev(),
    httpErrorHandler(),
    jsonSerializer(),
    contextProvider(),
    initSentry(),
    featureProtected(options?.requiredFeatures),
    metricsMiddleware(),
  ] as const
  return compose(...middlewares)
}
