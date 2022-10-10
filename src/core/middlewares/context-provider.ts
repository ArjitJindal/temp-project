import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { getContextStorage, getInitialContext } from '../utils/context'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

export const contextProvider =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, context, callback): Promise<APIGatewayProxyResult> => {
    const initialContext = await getInitialContext(event, context)
    return getContextStorage().run(initialContext, async () => {
      return handler(event, context, callback)
    })
  }
