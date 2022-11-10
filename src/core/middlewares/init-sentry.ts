import * as Sentry from '@sentry/serverless'

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { RewriteFrames } from '@sentry/integrations'
import { getContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'

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
      dsn: 'https://ecefa05b5cfb4b5998ccc8d4907012c8@o1295082.ingest.sentry.io/6567808', // I think we can hardcode this for now since it is same for all lambdas
      tracesSampleRate: 0.02,
      environment: process.env.ENV || 'local',
      release: process.env.RELEASE_VERSION,
      integrations: [
        new RewriteFrames({
          prefix: `app:///${process.env.LAMBDA_CODE_PATH}/`,
        }) as any,
      ],
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
