import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'

export const caseHandler = lambdaApi()(
  async (
    _event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {}
)
