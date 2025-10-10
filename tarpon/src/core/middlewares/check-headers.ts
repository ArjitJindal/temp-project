import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { BadRequest } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { determineApi } from '@/core/utils/api'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const checkHeaders =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    const contentType =
      event.headers?.['content-type'] || event.headers?.['Content-Type']
    const api = determineApi(ctx)
    if (
      api !== 'CONSOLE' &&
      ['POST', 'PUT', 'PATCH'].includes(event.httpMethod) &&
      !contentType?.includes('application/json')
    ) {
      throw new BadRequest("Content-Type header should be 'application/json'")
    }
    return await handler(event, ctx)
  }
