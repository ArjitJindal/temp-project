import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { logger } from '../logger'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { addNewSubsegment } from '@/core/xray'
import { determineApi } from '@/core/utils/api'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const xrayMiddleware =
  () =>
  (handler: CallableFunction): Handler =>
  async (event, ctx): Promise<APIGatewayProxyResult> => {
    const namespace = determineApi(ctx) || 'Unknown'
    const segmentName = `${event.httpMethod} ${event.path}`
    const segment = await addNewSubsegment(namespace, segmentName)
    if (event.requestContext && event.requestContext.authorizer) {
      const { principalId: tenantId, userId } = event.requestContext.authorizer
      segment?.addAnnotation('tenantId', tenantId)
      if (userId) {
        segment?.addAnnotation('userId', userId)
      }
    }
    segment?.addAnnotation(
      'queryStringParameters',
      JSON.stringify(event.queryStringParameters)
    )
    segment?.addAnnotation(
      'pathParameters',
      JSON.stringify(event.pathParameters)
    )
    logger.info(segmentName, {
      httpMethod: event.httpMethod,
      resouce: event.resource,
      queryStringParameters: event.queryStringParameters,
    })

    try {
      return await handler(event, ctx)
    } catch (err: any) {
      segment?.addError(err)
      throw err
    } finally {
      segment?.close()
    }
  }
