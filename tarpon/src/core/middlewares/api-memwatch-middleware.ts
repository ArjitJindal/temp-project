import { captureMessage } from '@sentry/node'
import { memwatchMiddleware } from './memwatch-middleware'

export const apiMemwatchMiddleware = () => {
  return memwatchMiddleware(captureMessage)
}
