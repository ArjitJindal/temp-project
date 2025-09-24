import {
  init as initNodeSentry,
  withScope as withScopeSentryNode,
} from '@sentry/node'
import { isQaEnv } from '@flagright/lib/qa'
import { getContext } from '../utils/context-storage'
import { envIs } from '@/utils/env'
import { SENTRY_INIT_CONFIG } from '@/utils/sentry'

export const initSentryNode =
  () =>
  (handler: CallableFunction): any =>
  async (): Promise<any> => {
    if (!envIs('dev', 'sandbox', 'prod') || isQaEnv()) {
      return handler()
    }

    initNodeSentry(SENTRY_INIT_CONFIG)

    return withScopeSentryNode((scope) => {
      scope.clear()
      scope.setTags(getContext()?.logMetadata || {})
      scope.setExtras(getContext()?.sentryExtras || {})
      return handler()
    })
  }
