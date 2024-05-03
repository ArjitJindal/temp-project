import * as Sentry from '@sentry/node'
import { isQaEnv } from '@flagright/lib/qa'
import { getContext } from '../utils/context'
import { envIs } from '@/utils/env'
import { SENTRY_INIT_CONFIG } from '@/utils/sentry'

export const initSentryNode =
  () =>
  (handler: CallableFunction): any =>
  async (): Promise<any> => {
    if (!envIs('dev', 'sandbox', 'prod') || isQaEnv()) {
      return handler()
    }

    Sentry.init(SENTRY_INIT_CONFIG)

    return Sentry.withScope(async () => {
      const scope = Sentry.getCurrentScope()
      scope.clear()
      Sentry.setTags(getContext()?.logMetadata || {})
      Sentry.setExtras(getContext()?.sentryExtras || {})
      return handler()
    })
  }
