import { compose } from './compose'
import { genericContextProviderNode } from './generic-context-provider-node'
import { initSentryNode } from './init-sentry-node'
import { registerUnhandledErrorHandler } from './lambda-utils'

export const nodeConsumer = () => {
  registerUnhandledErrorHandler()

  const middlewares = [genericContextProviderNode(), initSentryNode()] as const

  return compose(...middlewares)
}
