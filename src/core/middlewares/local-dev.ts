/* eslint-disable @typescript-eslint/no-explicit-any */
import https, { RequestOptions } from 'https'
import { IncomingMessage } from 'http'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

async function request(url: string, options: RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res: IncomingMessage) => {
      res.setEncoding('utf8')
      let rawData = ''
      res.on('data', (chunk: any) => {
        rawData += chunk
      })
      res.on('end', () => {
        resolve(rawData)
      })
    })
    req.on('error', (err: any) => {
      reject(new Error(err))
    })
    req.end()
  })
}

// todo: move to config
const CUSTOM_CLAIMS_NS = 'https://flagright.com'

export const localDev =
  () =>
  (handler: CallableFunction): Handler =>
  async (
    event: any,
    context: any,
    callback: any
  ): Promise<APIGatewayProxyResult> => {
    if (process.env.ENV === 'local') {
      let principalId = 'fake-demo-tenant-id'
      let tenantName = 'Unnamed tenant'
      let userId = 'test'

      const config = process.env as AccountsConfig
      const authorizationHeader = event.headers['Authorization']
      if (authorizationHeader != null) {
        try {
          const userInfoRaw = await request(
            `https://${config.AUTH0_DOMAIN}/userinfo`,
            {
              method: 'GET',
              headers: {
                Authorization: event.headers['Authorization'],
                'Content-Type': `application/json`,
              },
            }
          )
          const userInfo: Record<string, unknown> = JSON.parse(userInfoRaw)

          const userInfoTenantId = userInfo[CUSTOM_CLAIMS_NS + '/tenantId']
          const userInfoTenantName = userInfo[CUSTOM_CLAIMS_NS + '/tenantName']
          const userInfoUserId = userInfo[CUSTOM_CLAIMS_NS + '/userId']

          if (typeof userInfoTenantId === 'string') {
            principalId = userInfoTenantId
          }
          if (typeof userInfoTenantName === 'string') {
            tenantName = userInfoTenantName
          }
          if (typeof userInfoUserId === 'string') {
            userId = userInfoUserId
          }
        } catch (e: any) {
          throw new Error(
            `Unable to fetch userinfo, use mock data. ${
              e?.message ?? 'Unknown error'
            }`
          )
        }
      }
      const authorizer = event.requestContext.authorizer || {}
      event.requestContext.authorizer = {
        principalId,
        tenantName,
        userId,
        ...authorizer,
      }
    }
    return handler(event, context, callback)
  }
