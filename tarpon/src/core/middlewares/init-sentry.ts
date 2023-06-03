import * as Sentry from '@sentry/serverless'
import * as createError from 'http-errors'

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { RewriteFrames } from '@sentry/integrations'
import _ from 'lodash'
import { getContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { SENTRY_DSN } from '@/core/constants'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

export const initSentry =
  () =>
  (handler: CallableFunction): Handler => {
    if (process.env.ENV === 'local') {
      return async (
        event: any,
        context: any,
        callback: any
      ): Promise<APIGatewayProxyResult> => {
        return handler(event, context, callback)
      }
    }

    Sentry.AWSLambda.init({
      dsn: SENTRY_DSN, // I think we can hardcode this for now since it is same for all lambdas
      tracesSampleRate: 0,
      environment: process.env.ENV || 'local',
      release: process.env.RELEASE_VERSION,
      integrations: [
        new RewriteFrames({
          prefix: `app:///${process.env.LAMBDA_CODE_PATH}/`,
        }) as any,
      ],

      beforeSend(event, hint) {
        const error = hint?.originalException
        if (error instanceof createError.HttpError && error.statusCode < 500) {
          return null
        }
        const context = getContext()
        const lastError = context?.lastError
        if (lastError && _.isEqual(error, lastError)) {
          console.warn('Found duplicated error. Skip sending to Sentry.')
          return null
        }
        if (error instanceof Error && context) {
          context.lastError = error
        }
        return event
      },
    })

    return Sentry.AWSLambda.wrapHandler(
      async (event, context, callback): Promise<APIGatewayProxyResult> => {
        Sentry.configureScope((scope) => scope.clear())
        if (event.requestContext?.authorizer) {
          const { userId, verifiedEmail } = event.requestContext
            .authorizer as unknown as JWTAuthorizerResult
          Sentry.setUser({
            id: userId,
            email: verifiedEmail ?? undefined,
          })
        }
        Sentry.setTags(getContext()?.logMetadata || {})

        return handler(event, context, callback)
      }
    )
  }
