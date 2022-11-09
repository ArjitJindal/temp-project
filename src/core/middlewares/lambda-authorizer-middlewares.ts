import { compose } from './compose'
import { initSentry } from './init-sentry'
import { genericErrorHandler } from './generic-error-handler'
import { genericContextProvider } from './generic-context-provider'

export const lambdaAuthorizer = () => {
  const middlewares = [
    genericErrorHandler(),
    genericContextProvider(),
    initSentry(),
  ] as const
  return compose(...middlewares)
}
