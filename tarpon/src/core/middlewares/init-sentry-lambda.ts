import {
  init,
  rewriteFramesIntegration,
  wrapHandler,
  getCurrentScope,
  setUser,
  setTags,
  setContext,
  setTag,
  setExtras,
} from '@sentry/aws-serverless'
import { isQaEnv } from '@flagright/lib/qa'
import { getContext } from '../utils/context-storage'
import { SENTRY_INIT_CONFIG } from '@/utils/sentry'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { envIs } from '@/utils/env'

export const initSentryLambda =
  () =>
  (handler: CallableFunction): CallableFunction => {
    if (!envIs('dev', 'sandbox', 'prod') || isQaEnv()) {
      return async (event: any, ...args: any[]): Promise<any> => {
        return handler(event, ...args)
      }
    }

    init({
      ...SENTRY_INIT_CONFIG,
      debug: process.env.ENV === 'local', // Enable debug mode in local environment
      integrations: [
        rewriteFramesIntegration({
          prefix: `app:///lambdas/${process.env.LAMBDA_CODE_PATH}/`,
        }),
      ],
    })

    return wrapHandler(async (event: any, ...args): Promise<any> => {
      const scope = getCurrentScope()
      scope.clear()

      if (event.requestContext?.authorizer) {
        const { userId, verifiedEmail } = event.requestContext
          .authorizer as unknown as JWTAuthorizerResult
        setUser({
          id: userId,
          email: verifiedEmail ?? undefined,
        })
      }
      setTags(getContext()?.logMetadata || {})
      setContext(
        'query',
        (event?.queryStringParameters as Record<string, unknown>) || {}
      )
      setContext('body', (event?.body as Record<string, unknown>) || {})
      setContext(
        'path',
        (event?.pathParameters as Record<string, unknown>) || {}
      )
      setTag('httpMethod', event?.httpMethod || '')
      setTag('resource', event?.resource || '')
      setExtras(getContext()?.sentryExtras || {})

      return handler(event, ...args)
    })
  }
