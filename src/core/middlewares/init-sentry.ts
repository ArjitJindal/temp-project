import * as Sentry from '@sentry/serverless'

import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

export const initSentry =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, context, callback): Promise<APIGatewayProxyResult> => {
    Sentry.AWSLambda.init({
      dsn: 'https://ecefa05b5cfb4b5998ccc8d4907012c8@o1295082.ingest.sentry.io/6567808', // I think we can hardcode this for now since it is same for all lambdas
      tracesSampleRate: 0.02,
      environment: process.env.ENV ? process.env.ENV : 'development',
    })
    return handler(event, context, callback)
  }
