import { compose } from './compose'
import { genericContextProvider } from './generic-context-provider'
import { initSentry } from './init-sentry'
import { registerUnhandledErrorHandler } from './lambda-utils'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [genericContextProvider(), initSentry()] as const
  return compose(...middlewares)
}
