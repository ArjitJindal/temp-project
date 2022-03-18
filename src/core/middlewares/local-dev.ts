/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

export const localDev =
  () =>
  (handler: CallableFunction): Handler =>
  async (
    event: any,
    context: any,
    callback: any
  ): Promise<APIGatewayProxyResult> => {
    if (process.env.ENV === 'local') {
      const authorizer = event.requestContext.authorizer || {}
      event.requestContext.authorizer = {
        principalId: 'test',
        tenantName: 'test',
        ...authorizer,
      }
    }
    return handler(event, context, callback)
  }
