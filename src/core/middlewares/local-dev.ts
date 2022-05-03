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
    if (process.env.ENV === 'local') {
      const token = getToken(event)
      const decoded = jwt.decode(token, { complete: true })
      if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('Unable to read user data from token')
      }
      const userInfo = decoded.payload as Record<string, unknown>

      const authorizer = event.requestContext.authorizer || {}
      event.requestContext.authorizer = {
        principalId: userInfo[CUSTOM_CLAIMS_NS + '/tenantId'],
        tenantName:
          userInfo[CUSTOM_CLAIMS_NS + '/tenantName'] ?? 'Unnamed tenant',
        userId: userInfo[CUSTOM_CLAIMS_NS + '/userId'],
        ...authorizer,
      }
    }
    return handler(event, context, callback)
  }
