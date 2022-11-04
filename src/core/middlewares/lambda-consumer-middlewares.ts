import { initTracing } from '../xray'
initTracing()

import { compose } from './compose'
import { contextProvider } from './context-provider'
import { initSentry } from './init-sentry'

export const lambdaConsumer = () => {
  const middlewares = [contextProvider(), initSentry()] as const
  return compose(...middlewares)
}
