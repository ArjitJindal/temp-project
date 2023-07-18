import { compose } from './compose'
import { contextProvider } from './context-provider'
import { initSentry } from './init-sentry'
import { registerUnhandledErrorHandler } from './lambda-utils'

export const lambdaConsumer = () => {
  registerUnhandledErrorHandler()
  const middlewares = [contextProvider(), initSentry()] as const
  return compose(...middlewares)
}
