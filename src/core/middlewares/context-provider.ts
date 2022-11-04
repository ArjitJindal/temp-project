import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { getContextStorage, getInitialContext } from '../utils/context'
import { addNewSubsegment } from '../xray'
import { JWTAuthorizerResult } from '@/@types/jwt'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<
    AWS.STS.Credentials & JWTAuthorizerResult
  >
>

export const contextProvider =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, context, callback): Promise<APIGatewayProxyResult> => {
    const getInitialContextSegment = await addNewSubsegment(
      'API Middleware',
      'Get Initial Context'
    )
    const initialContext = await getInitialContext(event, context)
    getInitialContextSegment?.close()
    return getContextStorage().run(initialContext, async () => {
      return handler(event, context, callback)
    })
  }
