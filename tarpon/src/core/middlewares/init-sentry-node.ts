import * as Sentry from '@sentry/node'
import { getContext } from '../utils/context'
import { envIs } from '@/utils/env'
import { SENTRY_INIT_CONFIG } from '@/utils/sentry'

export const initSentryNode =
  () =>
  (handler: CallableFunction): any =>
  async (): Promise<any> => {
    if (!process.env.ENV || envIs('local')) {
      return handler()
    }

    Sentry.init(SENTRY_INIT_CONFIG)

    return Sentry.withScope(async () => {
      const scope = Sentry.getCurrentScope()
      scope.clear()
      Sentry.setTags(getContext()?.logMetadata || {})
      return handler()
    })
  }
