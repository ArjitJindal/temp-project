import { compose } from './compose'
import { genericContextProviderLambda } from './generic-context-provider-lambda'
import { initSentryLambda } from './init-sentry-lambda'
import { registerUnhandledErrorHandler } from './lambda-utils'
import { consumerMemwatchMiddleware } from './consumer-memwatch-middleware'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [
    genericContextProviderLambda(),
    consumerMemwatchMiddleware(),
    initSentryLambda(),
  ] as const
  return compose(...middlewares)
}
