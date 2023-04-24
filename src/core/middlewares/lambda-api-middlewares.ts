import * as sharedIniFileLoader from '@aws-sdk/shared-ini-file-loader'
import { compose } from './compose'
import { contextProvider } from './context-provider'
import { featureProtected } from './feature-protected'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'
import { initSentry } from './init-sentry'
import { metricsMiddleware } from './metrics-middleware'
import { Feature } from '@/@types/openapi-internal/Feature'
import { rbacMiddleware } from '@/core/middlewares/rbac'

// Workaround to get around EMFILE issue in lambda
// ref: https://github.com/aws/aws-sdk-js-v3/issues/3019#issuecomment-966900587
if (process.env.ENV !== 'local') {
  Object.assign(sharedIniFileLoader, {
    loadSharedConfigFiles:
      async (): Promise<sharedIniFileLoader.SharedConfigFiles> => ({
        configFile: {},
        credentialsFile: {},
      }),
  })
}

export const lambdaApi = (options?: { requiredFeatures?: Feature[] }) => {
  const middlewares = [
    localDev(),
    httpErrorHandler(),
    jsonSerializer(),
    contextProvider(),
    rbacMiddleware(),
    initSentry(),
    featureProtected(options?.requiredFeatures),
    metricsMiddleware(),
  ] as const
  return compose(...middlewares)
}
