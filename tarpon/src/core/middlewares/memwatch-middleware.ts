import {
  APIGatewayProxyWithLambdaAuthorizerEvent,
  APIGatewayEventLambdaAuthorizerContext,
  Context,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import type { SeverityLevel } from '@sentry/types'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { logger } from '@/core/logger'

let invocationCount = 0

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials & JWTAuthorizerResult>
>

type CaptureMessageFn = (
  message: string,
  captureContext?:
    | { level?: SeverityLevel; extra?: Record<string, any> }
    | SeverityLevel
) => string | void

export const memwatchMiddleware = (
  captureMessageFn: CaptureMessageFn = (message, options) => {
    if (typeof options === 'object' && options && 'extra' in options) {
      logger.warn(message, options.extra)
    } else {
      logger.warn(message)
    }
    return ''
  }
) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const memwatch = require('@airbnb/node-memwatch')
  return (handler: CallableFunction): Handler => {
    return async (
      event: APIGatewayProxyWithLambdaAuthorizerEvent<
        APIGatewayEventLambdaAuthorizerContext<
          Credentials & JWTAuthorizerResult
        >
      >,
      context: Context
    ) => {
      invocationCount++
      logger.info(`Starting memwatch tracking (invocation #${invocationCount})`)

      const leakListener = (info: any) => {
        captureMessageFn(
          `MEMORY LEAK DETECTED (invocation #${invocationCount}):`,
          {
            level: 'warning' as SeverityLevel,
            extra: {
              info,
            },
          }
        )
      }
      const statsListener = (stats: any) => {
        logger.info(`HEAP STATS (invocation #${invocationCount}):`, stats)
      }
      memwatch.on('leak', leakListener)
      memwatch.on('stats', statsListener)

      const result = await handler(event, context)
      memwatch.removeListener('leak', leakListener)
      memwatch.removeListener('stats', statsListener)
      return result
    }
  }
}
