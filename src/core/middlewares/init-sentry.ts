import * as Sentry from '@sentry/serverless'

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { RewriteFrames } from '@sentry/integrations'
import { Event } from '@sentry/serverless'
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

    let lastEvent: Event
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

      beforeSend(event) {
        // If this is a normal error and is the same as the last.
        if (
          lastEvent &&
          event.extra?.stack &&
          event.extra?.stack == lastEvent.extra?.stack
        ) {
          // Duplicate, do nothing.
          return null
        }
        lastEvent = event
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
