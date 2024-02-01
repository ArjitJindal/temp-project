import * as Sentry from '@sentry/serverless'
import { RewriteFrames, Debug } from '@sentry/integrations'
import { isQaEnv } from '@lib/qa'
import { getContext } from '../utils/context'
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

    Sentry.AWSLambda.init({
      ...SENTRY_INIT_CONFIG,
      integrations: [
        new RewriteFrames({
          prefix: `app:///lambdas/${process.env.LAMBDA_CODE_PATH}/`,
        }) as any,
        new Debug(),
      ],
    })

    return Sentry.AWSLambda.wrapHandler(
      async (event: any, ...args): Promise<any> => {
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
          (event?.queryStringParameters as object) || {}
        )
        Sentry.setContext('body', (event?.body as object) || {})
        Sentry.setContext('path', (event?.pathParameters as object) || {})
        Sentry.setTag('httpMethod', event?.httpMethod || '')
        Sentry.setTag('resource', event?.resource || '')

        return handler(event, ...args)
      }
    )
  }
