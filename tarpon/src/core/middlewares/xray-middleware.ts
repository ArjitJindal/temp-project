import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { addNewSubsegment } from '@/core/xray'
import { determineApi } from '@/core/utils/api'
type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<
    AWS.STS.Credentials & JWTAuthorizerResult
  >
>

export const xrayMiddleware =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    const namespace = determineApi(ctx) || 'Unknown'
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const segmentName = `${event.httpMethod} ${event.path}`
    const segment = await addNewSubsegment(namespace, segmentName)
    segment?.addAnnotation('tenantId', tenantId)
    segment?.addAnnotation('userId', userId)
    segment?.addAnnotation(
      'queryStringParameters',
      JSON.stringify(event.queryStringParameters)
    )
    segment?.addAnnotation(
      'pathParameters',
      JSON.stringify(event.pathParameters)
    )

    try {
      return await handler(event, ctx)
    } catch (err: any) {
      segment?.addError(err)
      throw err
    } finally {
      segment?.close()
    }
  }
