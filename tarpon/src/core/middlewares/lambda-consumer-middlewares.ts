import { compose } from './compose'
import { genericContextProviderLambda } from './generic-context-provider-lambda'
import { initSentryLambda } from './init-sentry-lambda'
import { registerUnhandledErrorHandler } from './lambda-utils'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [
    genericContextProviderLambda(),
    initSentryLambda(),
  ] as const
  return compose(...middlewares)
}
