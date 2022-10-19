/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
    let body = 'OK'
    let headers = {}

    if (response?.headers && response?.body) {
      headers = response.headers
      body = response.body
    } else if (response) {
      body = JSON.stringify(response)
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...headers,
      },
      body,
    }
  }
