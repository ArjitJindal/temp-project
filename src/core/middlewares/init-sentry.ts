import * as Sentry from '@sentry/serverless'

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

export const initSentry =
  () =>
  (handler: CallableFunction): Handler => {
    Sentry.AWSLambda.init({
      dsn: 'https://ecefa05b5cfb4b5998ccc8d4907012c8@o1295082.ingest.sentry.io/6567808', // I think we can hardcode this for now since it is same for all lambdas
      tracesSampleRate: 0.02,
      environment: process.env.ENV || 'local',
    })

    return Sentry.AWSLambda.wrapHandler(
      async (event, context, callback): Promise<APIGatewayProxyResult> => {
        if (
          event.requestContext != null &&
          event.requestContext.authorizer != null
        ) {
          const { principalId, userId, tenantName, verifiedEmail } = event
            .requestContext.authorizer as unknown as JWTAuthorizerResult

          Sentry.setUser({
            id: userId,
            email: verifiedEmail ?? undefined,
          })
          Sentry.setTag('tenant', `${principalId} (${tenantName})`)
        }

        return handler(event, context, callback)
      }
    )
  }
