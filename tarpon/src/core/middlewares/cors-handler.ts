import { APIGatewayProxyResult, Handler } from 'aws-lambda'
import { isEmpty } from 'lodash'
import { InternalServerError } from 'http-errors'
import { getAllowedOrigins } from '@lib/openapi/openapi-internal-constants'
import { logger } from '@/core/logger'

// corsHandler sets the `Access-Control-Allow-Origin` header to the appropriate value. To be placed and used after
// json-serializer and httpErrorHandler middlewares
export const corsHandler =
  () =>
  (handler: CallableFunction): Handler => {
    return async (event, context): Promise<APIGatewayProxyResult> => {
      const response = await handler(event, context)
      if (isEmpty(response.headers)) {
        // This middleware assumes that the response headers are set before this handler is invoked
        logger.error(`corsHandler: response.headers is empty`)
        throw new InternalServerError(`Something went wrong`)
      }

      const allowedOrigins = getAllowedOrigins()
      const origin = event.headers['Origin'] || event.headers['origin'] || ''

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        response.headers['Access-Control-Allow-Origin'] = origin
      }

      return response
    }
  }
