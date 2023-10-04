import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getInitialContext, withContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const apiContextProvider =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, context, callback): Promise<APIGatewayProxyResult> => {
    const initialContext = await getInitialContext(event, context)
    return withContext(async () => {
      return handler(event, context, callback)
    }, initialContext)
  }
