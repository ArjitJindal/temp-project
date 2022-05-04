/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import * as jwt from 'jsonwebtoken'
import { getToken } from '@/lambdas/jwt-authorizer/app'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
>

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
    const authorizer = event.requestContext.authorizer || {}
    if (process.env.EXEC_SOURCE === 'cli') {
      event.requestContext.authorizer = {
        principalId: 'unset',
        tenantName: 'unset',
        userId: 'unset',
        ...authorizer,
      }
    } else if (process.env.ENV === 'local') {
      if (
        event.headers?.['authorization'] ||
        event.headers?.['Authorization']
      ) {
        // For requests from Console
        const token = getToken(event)
        const decoded = jwt.decode(token, { complete: true })
        if (!decoded || !decoded.header || !decoded.header.kid) {
          throw new Error('Unable to read user data from token')
        }
        const userInfo = decoded.payload as Record<string, unknown>

        event.requestContext.authorizer = {
          principalId: userInfo[`${CUSTOM_CLAIMS_NS}/tenantId`],
          tenantName:
            userInfo[`${CUSTOM_CLAIMS_NS}/tenantName`] ?? 'Unnamed tenant',
          userId: userInfo[`${CUSTOM_CLAIMS_NS}/userId`],
          ...authorizer,
        }
      } else {
        // For requests of the public REST APIs
        event.requestContext.authorizer = {
          principalId: event.headers?.['Tenant-Id'] || 'unset',
          tenantName: event.headers?.['Tenant-Name'] || 'unset',
          userId: event.headers?.['User-Id'] || 'unset',
          ...authorizer,
        }
      }
    }
    return handler(event, context, callback)
  }
