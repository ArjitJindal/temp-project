/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
>

export const jsonSerializer =
  () =>
  (handler: CallableFunction): Handler =>
  async (
    event: any,
    context: any,
    callback: any
  ): Promise<APIGatewayProxyResult> => {
    // Decode URI for all path parameters
    if (event.pathParameters) {
      for (const pathKey in event.pathParameters) {
        if (event.pathParameters[pathKey]) {
          event.pathParameters[pathKey] = decodeURIComponent(
            event.pathParameters[pathKey]
          )
        }
      }
    }
    const response = await handler(event, context, callback)
    let headers = {}

    let body
    if (response?.headers && response?.body) {
      headers = response.headers
      body = response.body
    } else if (response) {
      body = JSON.stringify(response)
    } else {
      body = JSON.stringify(null)
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
    }
  }
