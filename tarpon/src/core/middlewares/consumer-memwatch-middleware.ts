import { captureMessage } from '@sentry/serverless'
import { memwatchMiddleware } from './memwatch-middleware'

export const consumerMemwatchMiddleware = () => {
  return memwatchMiddleware(captureMessage)
}
