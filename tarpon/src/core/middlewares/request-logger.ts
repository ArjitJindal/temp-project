import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  APIGatewayProxyWithLambdaAuthorizerHandler,
  Context,
} from 'aws-lambda'
import { logger } from '../logger'
import { getContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { RequestLogger } from '@/@types/request-logger'
import { API_REQUEST_LOG } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { background } from '@/utils/background'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

export const requestLoggerMiddleware = () => {
  return (handler: CallableFunction): Handler => {
    return async (
      event: APIGatewayProxyWithLambdaAuthorizerEvent<
        APIGatewayEventLambdaAuthorizerContext<
          Credentials & JWTAuthorizerResult
        >
      >,
      context: Context
    ) => {
      try {
        const response = await handler(event, context)
        await logRequest(event, context, response)
        return response
      } catch (error) {
        await logRequest(event, context, {
          body: (error as Error).message,
          message: (error as Error).message,
          statusCode: (error as any).statusCode ?? 500,
        })

        throw error
      }
    }
  }
}

async function logRequest(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
  >,
  context: Context,
  response: {
    body?: any
    message?: string
    statusCode: number
  }
) {
  try {
    const mongoDb = await getMongoDbClient()
    const tenantId = getContext()?.tenantId as string
    const requestLoggerCollectionName = API_REQUEST_LOG(tenantId)
    const db = mongoDb.db()
    const localContext = getContext()

    const requestLoggerCollection = db.collection(requestLoggerCollectionName)
    const data: RequestLogger = {
      context,
      method: event.httpMethod,
      path: event.path,
      responseCode: response.statusCode,
      timestamp: Date.now(),
      userId: localContext?.user?.id,
      payload:
        typeof event.body === 'string'
          ? JSON.parse(event.body)
          : event.body ?? {},
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
      domainName: event.requestContext.domainName,
      multiValueQueryStringParameters: event.multiValueQueryStringParameters,
      error: response.statusCode >= 400 ? response.body : undefined,
      message: response.statusCode >= 400 ? response.message : undefined,
    }
    if (event.httpMethod !== 'GET') {
      await background(requestLoggerCollection.insertOne(data))
    }
  } catch (error) {
    logger.error(`Failed to log request: ${(error as Error).message}`)
  }
}
