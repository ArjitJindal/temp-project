import { compose } from './compose'
import { contextProvider } from './context-provider'
import { initSentry } from './init-sentry'
import { registerUnhandledErrorHandler } from './lambda-utils'
import { resourceCleanupHandler } from './resource-cleanup-handler'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [
    contextProvider(),
    initSentry(),
    resourceCleanupHandler(),
  ] as const
  return compose(...middlewares)
}
