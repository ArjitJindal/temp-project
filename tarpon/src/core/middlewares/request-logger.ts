import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  APIGatewayProxyWithLambdaAuthorizerHandler,
  Context,
} from 'aws-lambda'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { isEmpty } from 'lodash'
import { logger } from '../logger'
import { getContext } from '../utils/context'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { background } from '@/utils/background'
import { envIs } from '@/utils/env'
import { ApiRequestLog } from '@/@types/request-logger'
import { handleRequestLoggerTask } from '@/lambdas/request-logger/app'
import { getErrorMessage } from '@/utils/lang'
import { getSQSClient } from '@/utils/sns-sqs-client'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>
const sqsClient = getSQSClient()

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

const LOGGABLE_METHODS = ['PUT', 'POST', 'PATCH']

async function logRequest(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
  >,
  context: Context
) {
  try {
    const payload = (() => {
      if (typeof event.body === 'string') {
        try {
          return JSON.parse(event.body)
        } catch (error) {
          logger.error(`Unable to parse string: ${getErrorMessage(error)}`, {
            body: event.body.slice(0, 100),
          })
        }
      } else {
        return event.body ?? {}
      }
    })()

    if (!LOGGABLE_METHODS.includes(event.httpMethod) || !isEmpty(payload)) {
      return
    }
    const tenantId = getContext()?.tenantId as string
    const localContext = getContext()

    const data: ApiRequestLog = {
      context,
      method: event.httpMethod,
      path: event.path,
      timestamp: Date.now(),
      userId: localContext?.user?.id,
      payload,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
      domainName: event.requestContext.domainName,
      multiValueQueryStringParameters: event.multiValueQueryStringParameters,
      tenantId,
      requestId: getContext()?.logMetadata?.requestId,
      traceId: getContext()?.logMetadata?.traceId,
    }

    const sqsMessage = new SendMessageCommand({
      QueueUrl: process.env.REQUEST_LOGGER_QUEUE_URL as string,
      MessageBody: JSON.stringify(data),
    })

    if (envIs('local') || envIs('test')) {
      await handleRequestLoggerTask([data])
    } else {
      await background(sqsClient.send(sqsMessage))
    }
  } catch (error) {
    logger.error(`Failed to log request: ${(error as Error).message}`)
  }
}
