import * as Sentry from '@sentry/aws-serverless'
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

    Sentry.init({
      ...SENTRY_INIT_CONFIG,
      debug: process.env.ENV === 'local', // Enable debug mode in local environment
      integrations: [
        Sentry.rewriteFramesIntegration({
          prefix: `app:///lambdas/${process.env.LAMBDA_CODE_PATH}/`,
        }),
      ],
    })

    return Sentry.wrapHandler(async (event: any, ...args): Promise<any> => {
      const scope = Sentry.getCurrentScope()
      scope.clear()

      if (event.requestContext?.authorizer) {
        const { userId, verifiedEmail } = event.requestContext
          .authorizer as unknown as JWTAuthorizerResult
        Sentry.setUser({
          id: userId,
          email: verifiedEmail ?? undefined,
        })
      }
      Sentry.setTags(getContext()?.logMetadata || {})
      Sentry.setContext(
        'query',
        (event?.queryStringParameters as Record<string, unknown>) || {}
      )
      Sentry.setContext('body', (event?.body as Record<string, unknown>) || {})
      Sentry.setContext(
        'path',
        (event?.pathParameters as Record<string, unknown>) || {}
      )
      Sentry.setTag('httpMethod', event?.httpMethod || '')
      Sentry.setTag('resource', event?.resource || '')
      Sentry.setExtras(getContext()?.sentryExtras || {})

      return handler(event, ...args)
    })
  }
