import * as Sentry from '@sentry/node'
import * as createError from 'http-errors'
import { isEqual } from 'lodash'
import { getContext } from '@/core/utils/context-storage'
import { SENTRY_DSN } from '@/core/constants'

export const SENTRY_INIT_CONFIG: Sentry.NodeOptions = {
  dsn: SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.ENV || 'local',
  release: process.env.RELEASE_VERSION,

  beforeSend(event, hint) {
    const error = hint?.originalException
    if (error instanceof createError.HttpError && error.statusCode < 500) {
      return null
    }
    const context = getContext()
    const lastError = context?.lastError
    if (lastError && isEqual(error, lastError)) {
      console.warn('Found duplicated error. Skip sending to Sentry.')
      return null
    }
    if (error instanceof Error && context) {
      context.lastError = error
    }
    return event
  },
}
