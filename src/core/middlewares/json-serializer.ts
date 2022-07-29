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
    if (!response) {
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      }
    }

    if (response?.headers && response?.body) {
      return {
        statusCode: 200,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Origin': '*',
        },
        body: response.body,
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    }
  }
