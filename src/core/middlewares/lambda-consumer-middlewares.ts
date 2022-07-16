import { compose } from './compose'
import { initSentry } from './init-sentry'

export const lambdaConsumer = () => {
  const middlewares = [initSentry()] as const
  return compose(...middlewares)
}
