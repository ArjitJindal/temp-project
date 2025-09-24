import { APIGatewayProxyResult, Handler } from 'aws-lambda'
import isEmpty from 'lodash/isEmpty'
import { InternalServerError } from 'http-errors'
import { getAllowedOrigins } from '@lib/openapi/openapi-internal-constants'
import { logger } from '@/core/logger'

// responseHeaderHandler sets the `Access-Control-Allow-Origin` header to the appropriate value. Also, sets the HTTP
// headers enforcing tighter security. To be placed and used after json-serializer and httpErrorHandler middlewares
export const responseHeaderHandler =
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

      // Set the securityHeaders
      const securityHeaders = getHTTPSecurityHeaders()
      response.headers = {
        ...response.headers,
        ...securityHeaders,
      }

      return response
    }
  }

function getHTTPSecurityHeaders() {
  // HTTP headers enforcing much tighter security
  //
  // HelmetJS(https://github.com/helmetjs/helmet) is a well established HTTP security middleware for NodeJS. But, it
  // only works with the HTTP Servers like ExpressJS. For Lambda, we need to set the headers manually. The following
  // headers are set
  // The easiest way to maintain the headers is to use the HelmetJS in a sample express app and then use the
  // response headers set by HelmetJS. The headers enforcing security are forever evolving and it is best to use
  // the latest headers set by HelmetJS

  /**
   * const express = require('express')
   * const app = express()
   * const Helmet = require('helmet')
   * const port = 4567
   * const Axios = require('axios')
   *
   * // Customize what headers you want to set/modified - https://helmetjs.github.io/
   * app.use(Helmet())
   * app.get('/', (req, res) => {
   *   res.send('Hello World!')
   * })
   *
   * app.listen(port, async () => {
   *   console.log(`Example app listening on port ${port}`)
   *   const res = await Axios.get(`http://localhost:${port}`);
   *
   *   // This prints all the security headers set by HelmetJS
   *   console.log(JSON.stringify(res.headers))
   * })
   */

  // The easiest way to test the headers is through https://securityheaders.com/. The following headers are set
  return {
    'content-security-policy':
      "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'origin-agent-cluster': '?1',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=15552000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-download-options': 'noopen',
    'x-frame-options': 'SAMEORIGIN',
    'x-permitted-cross-domain-policies': 'none',
    'x-xss-protection': '0',
  }
}
