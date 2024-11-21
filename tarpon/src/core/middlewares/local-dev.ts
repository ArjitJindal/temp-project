/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import * as jwt from 'jsonwebtoken'
import { Credentials } from '@aws-sdk/client-sts'
import { getToken } from '@/lambdas/jwt-authorizer/app'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getFullTenantId } from '@/utils/tenant'
import { envIsNot } from '@/utils/env'

type Handler = APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<Credentials>
>

// todo: move to config
const CUSTOM_CLAIMS_NS = 'https://flagright.com'
const AWS_API_GATEWAY_TIMEOUT = 30 * 1000

export const localDev =
  () =>
  (handler: CallableFunction): Handler =>
  async (
    event: any,
    context: any,
    callback: any
  ): Promise<APIGatewayProxyResult> => {
    if (envIsNot('local')) {
      return handler(event, context, callback)
    }

    const authorizer = event.requestContext.authorizer || {}
    if (process.env.EXEC_SOURCE === 'cli') {
      event.requestContext.authorizer = {
        principalId: 'flagright',
        tenantName: 'flagright',
        userId: 'unknown',
        role: 'user',
        auth0Domain: 'dev-flagright.eu.auth0.com',
        ...authorizer,
      }
    } else {
      if (
        event.headers?.['authorization'] ||
        event.headers?.['Authorization']
      ) {
        // For requests from Console
        const token = getToken(event)
        if (!token) {
          throw new Error('Unable to get token')
        }
        const decoded = jwt.decode(token, { complete: true })
        if (!decoded || !decoded.header || !decoded.header.kid) {
          throw new Error('Unable to read user data from token')
        }
        const userInfo = decoded.payload as Record<string, unknown>

        const tenantId = userInfo[`${CUSTOM_CLAIMS_NS}/tenantId`]
        const demoMode = userInfo[`${CUSTOM_CLAIMS_NS}/demoMode`] === true

        const fullTenantId = getFullTenantId(tenantId as string, demoMode)
        const permissionsArray = (userInfo[`permissions`] || []) as Permission[]
        const allowedRegions = userInfo[
          `${CUSTOM_CLAIMS_NS}/allowedRegions`
        ] as string[] | undefined
        const encodedPermissions = permissionsArray.join(',')
        const encodedAllowedRegions = allowedRegions?.join(',')

        const jwtAuthorizerResult: JWTAuthorizerResult = {
          principalId: fullTenantId,
          tenantId,
          tenantName:
            userInfo[`${CUSTOM_CLAIMS_NS}/tenantName`] ?? 'Unnamed tenant',
          verifiedEmail:
            userInfo[`${CUSTOM_CLAIMS_NS}/verifiedEmail`] ?? undefined,
          userId: userInfo[`${CUSTOM_CLAIMS_NS}/userId`],
          encodedPermissions,
          role: userInfo[CUSTOM_CLAIMS_NS + '/role'],
          auth0Domain: 'dev-flagright.eu.auth0.com',
          allowTenantDeletion:
            userInfo[`${CUSTOM_CLAIMS_NS}/allowTenantDeletion`] === true,
          encodedAllowedRegions,
          ...authorizer,
        }
        event.requestContext.authorizer = jwtAuthorizerResult
      } else {
        // For requests of the public REST APIs
        const jwtAuthorizerResult: JWTAuthorizerResult = {
          principalId: event.headers?.['tenant-id'] || 'flagright',
          tenantName: event.headers?.['tenant-name'] || 'flagright',
          userId: event.headers?.['user-id'] || 'unknown',
          ...authorizer,
        }
        event.requestContext.authorizer = jwtAuthorizerResult
      }
    }
    const result = await Promise.race([
      handler(event, context, callback),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), AWS_API_GATEWAY_TIMEOUT)
      ),
    ])
    return result
  }
