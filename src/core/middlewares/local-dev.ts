/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import * as jwt from 'jsonwebtoken'
import { getFullTenantId, getToken } from '@/lambdas/jwt-authorizer/app'
import { JWTAuthorizerResult } from '@/@types/jwt'

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
        role: 'user',
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

        const tenantId = userInfo[`${CUSTOM_CLAIMS_NS}/tenantId`]
        const demoMode = userInfo[`${CUSTOM_CLAIMS_NS}/demoMode`] === true

        const fullTenantId = getFullTenantId(tenantId as string, demoMode)

        const jwtAuthorizerResult: JWTAuthorizerResult = {
          principalId: fullTenantId,
          tenantName:
            userInfo[`${CUSTOM_CLAIMS_NS}/tenantName`] ?? 'Unnamed tenant',
          verifiedEmail:
            userInfo[`${CUSTOM_CLAIMS_NS}/verifiedEmail`] ?? undefined,
          userId: userInfo[`${CUSTOM_CLAIMS_NS}/userId`],
          role: userInfo[CUSTOM_CLAIMS_NS + '/role'],
          ...authorizer,
        }
        event.requestContext.authorizer = jwtAuthorizerResult
      } else {
        // For requests of the public REST APIs
        const jwtAuthorizerResult: JWTAuthorizerResult = {
          principalId: event.headers?.['tenant-id'] || 'unset',
          tenantName: event.headers?.['tenant-name'] || 'unset',
          userId: event.headers?.['user-id'] || 'unset',
          ...authorizer,
        }
        event.requestContext.authorizer = jwtAuthorizerResult
      }
    }
    return handler(event, context, callback)
  }
