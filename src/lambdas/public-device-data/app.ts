import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'

export const deviceDataHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/device/metric' &&
      event.pathParameters?.ruleInstanceId &&
      event.body
    ) {
      return true
    }

    throw new Error('Unhandled request')
  }
)
