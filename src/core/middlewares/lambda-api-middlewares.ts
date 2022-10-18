import { compose } from './compose'
import { contextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'
import { initSentry } from './init-sentry'
import { Feature } from '@/@types/openapi-internal/Feature'

export const lambdaApi = (options?: { requiredFeatures?: Feature[] }) => {
  const middlewares = [
    localDev(),
    httpErrorHandler(),
    jsonSerializer(),
    contextProvider(),
    initSentry(),
    featureProtected(options?.requiredFeatures),
  ] as const
  return compose(...middlewares)
}
