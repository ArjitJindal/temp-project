import { compose } from './compose'
import { genericContextProvider } from './generic-context-provider'
import { initSentry } from './init-sentry'
import { registerUnhandledErrorHandler } from './lambda-utils'
import { resourceCleanupHandler } from './resource-cleanup-handler'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [
    genericContextProvider(),
    initSentry(),
    resourceCleanupHandler(),
  ] as const
  return compose(...middlewares)
}
