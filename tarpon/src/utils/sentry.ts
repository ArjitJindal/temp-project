import { NodeOptions as SentryNodeOptions } from '@sentry/node'
import { HttpError } from 'http-errors'
import { generateChecksum } from './object'
import { getContext } from '@/core/utils/context-storage'
import { SENTRY_DSN } from '@/core/constants'

export const SENTRY_INIT_CONFIG: SentryNodeOptions = {
  dsn: SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.ENV || 'local',
  release: process.env.RELEASE_VERSION,

  beforeSend(event, hint) {
    const error = hint?.originalException
    if (error instanceof HttpError && error.statusCode < 500) {
      return null
    }
    const currentErrorHash = generateChecksum(error, 32)
    const context = getContext()
    const lastErrorHash = context?.lastErrorHash
    if (lastErrorHash && lastErrorHash === currentErrorHash) {
      console.warn('Found duplicated error. Skip sending to Sentry.')
      return null
    }
    if (error instanceof Error && context) {
      context.lastErrorHash = currentErrorHash
    }
    return event
  },
}
