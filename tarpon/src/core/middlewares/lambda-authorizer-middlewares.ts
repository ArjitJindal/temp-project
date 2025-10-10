import { compose } from './compose'
import { initSentryLambda } from './init-sentry-lambda'
import { genericErrorHandler } from './generic-error-handler'
import { genericContextProviderLambda } from './generic-context-provider-lambda'
import { registerUnhandledErrorHandler } from './lambda-utils'

export const lambdaAuthorizer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [
    genericErrorHandler(),
    genericContextProviderLambda(),
    initSentryLambda(),
  ] as const
  return compose(...middlewares)
}
