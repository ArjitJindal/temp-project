import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { logger } from '@/core/logger'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const checkHeaders =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    const contentType =
      event.headers?.['content-type'] || event.headers?.['Content-Type']
    if (!contentType || !contentType.includes('application/json')) {
      logger.error('content type is not correct', contentType)
    }
    return await handler(event, ctx)
  }
