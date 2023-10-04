import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  APIGatewayProxyWithLambdaAuthorizerHandler,
  Context,
} from 'aws-lambda'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { logger } from '../logger'
import { getContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { background } from '@/utils/background'
import { envIs } from '@/utils/env'
import { RequestLogger } from '@/@types/request-logger'
import { handleRequestLoggerTask } from '@/lambdas/request-logger/app'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

const sqsClient = new SQSClient({})

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
      await background(logRequest(event, context))
      const response = await handler(event, context)
      return response
    }
  }
}

async function logRequest(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
  >,
  context: Context
) {
  try {
    const tenantId = getContext()?.tenantId as string
    const localContext = getContext()

    const data: RequestLogger = {
      context,
      method: event.httpMethod,
      path: event.path,
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
      tenantId,
      requestId: getContext()?.logMetadata?.requestId,
      traceId: getContext()?.logMetadata?.traceId,
    }

    if (event.httpMethod !== 'GET') {
      const sqsMessage = new SendMessageCommand({
        QueueUrl: process.env.REQUEST_LOGGER_QUEUE_URL as string,
        MessageBody: JSON.stringify(data),
      })

      if (envIs('local') || envIs('test')) {
        await handleRequestLoggerTask(data)
      } else {
        await background(sqsClient.send(sqsMessage))
      }
    }
  } catch (error) {
    logger.error(`Failed to log request: ${(error as Error).message}`)
  }
}
