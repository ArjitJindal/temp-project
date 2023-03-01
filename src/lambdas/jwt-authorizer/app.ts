import * as AWS from 'aws-sdk'
import * as ARN from '@aws-sdk/util-arn-parser'

import {
  APIGatewayAuthorizerResult,
  APIGatewayAuthorizerResultContext,
  APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { StackConstants } from '@cdk/constants'
import { getAuth0TenantConfigs } from '@cdk/auth0/tenant-config'
import PolicyBuilder from '@/core/policies/policy-generator'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaAuthorizer } from '@/core/middlewares/lambda-authorizer-middlewares'
import { updateLogMetadata } from '@/core/utils/context'
import { Permission } from '@/@types/openapi-internal/Permission'
import { logger } from '@/core/logger'
import { isValidAccountRoleName } from '@/@types/openapi-internal-custom/AccountRoleName'

const UNAUTHORIZED_RESPONSE = {
  principalId: 'unknown',
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Deny',
        Action: '*',
        Resource: ['*'],
      },
    ],
  },
}

const AUTH0_CUSTOM_CLAIMS_NAMESPACE = 'https://flagright.com'

async function getTenantScopeCredentials(
  tenantId: string,
  accountId: string,
  requestId: string
): Promise<AWS.STS.Credentials> {
  const sts = new AWS.STS()
  const assumeRoleResult = await sts
    .assumeRole({
      RoleArn: process.env.AUTHORIZER_BASE_ROLE_ARN as string,
      RoleSessionName: requestId,
      Policy: JSON.stringify(
        new PolicyBuilder(tenantId)
          .s3()
          .secretsManager()
          .dynamoDb([
            StackConstants.TARPON_DYNAMODB_TABLE_NAME,
            StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
            StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
          ])
          .build()
      ),
      DurationSeconds: StackConstants.JWT_AUTHORIZER_CACHE_TTL_SECONDS,
    })
    .promise()
  if (!assumeRoleResult.Credentials) {
    throw new Error('Got empty credentials from STS')
  }

  return assumeRoleResult.Credentials
}

export const getToken = (
  event: APIGatewayRequestAuthorizerEvent
): string | null => {
  const token =
    event.headers?.['authorization'] ?? event.headers?.['Authorization']
  if (!token) {
    logger.warn('Expected "Authorization" header to be set')
    return null
  }

  const match = token.match(/^Bearer (.*)$/)
  if (!match || match.length < 2) {
    logger.warn(
      `Invalid Authorization token - ${token} does not match "Bearer .*"`
    )
    return null
  }
  return match[1]
}

export const getFullTenantId = (tenantId: string, demoMode: boolean) => {
  return tenantId + (demoMode ? `-test` : '')
}

export const jwtAuthorizer = lambdaAuthorizer()(
  async (
    event: APIGatewayRequestAuthorizerEvent
  ): Promise<APIGatewayAuthorizerResult> => {
    const arn = ARN.parse(event.methodArn)
    const { apiId, stage, accountId, requestId } = event.requestContext
    const token = getToken(event)
    if (!token) {
      return UNAUTHORIZED_RESPONSE
    }

    updateLogMetadata({ jwtToken: token })

    let kid: string
    let auth0Domain: string
    try {
      const decoded = jwt.decode(token, { complete: true })
      if (!decoded?.header?.kid) {
        logger.warn('token failed to be decoded')
        return UNAUTHORIZED_RESPONSE
      }
      kid = decoded?.header?.kid
      auth0Domain =
        (decoded.payload as jwt.JwtPayload)?.[
          `${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/auth0Domain`
        ] || (process.env.AUTH0_DOMAIN as string)
    } catch (e) {
      logger.warn('token failed to be decoded')
      return UNAUTHORIZED_RESPONSE
    }

    const auth0TenantName = auth0Domain.split('.')[0]
    const tenantConfig = getAuth0TenantConfigs(process.env.ENV as any).find(
      (config) => config.tenantName === auth0TenantName
    )
    if (!tenantConfig) {
      throw new Error(`Cannot find auth0 tenant config for ${auth0Domain}`)
    }

    const jwks = jwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10, // Default value
      jwksUri: `https://${tenantConfig.customDomain}/.well-known/jwks.json`,
    })
    const key = await jwks.getSigningKey(kid)
    const signingKey = key.getPublicKey()

    let verifiedDecoded: jwt.JwtPayload
    try {
      verifiedDecoded = jwt.verify(token, signingKey, {
        audience: process.env.AUTH0_AUDIENCE,
        // IMPORTANT: The ending '/' is required
        issuer: `https://${tenantConfig.customDomain}/`,
      }) as jwt.JwtPayload
    } catch (e) {
      logger.warn('token failed to be verified')
      return UNAUTHORIZED_RESPONSE
    }

    updateLogMetadata({ verifiedJwtPayload: verifiedDecoded })

    // TODO: Use role
    const role = verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/role`]
    const tenantId =
      verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/tenantId`]
    const tenantName =
      verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/tenantName`]
    const verifiedEmail =
      verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/verifiedEmail`]
    const demoMode =
      process.env.ENV === 'sandbox' &&
      verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/demoMode`] === true
    const fullTenantId = getFullTenantId(tenantId, demoMode)
    const tenantScopeCredentials = await getTenantScopeCredentials(
      fullTenantId,
      accountId,
      requestId
    )

    let permissionsArray: Permission[] = []
    if (
      verifiedDecoded.permissions !== undefined &&
      Array.isArray(verifiedDecoded.permissions)
    ) {
      permissionsArray = verifiedDecoded[`permissions`]
    }
    const encodedPermissions = permissionsArray.join(',')
    return {
      principalId: fullTenantId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'execute-api:Invoke',
            // ARN format: https://docs.aws.amazon.com/apigateway/latest/developerguide/arn-format-reference.html
            Resource: [
              `arn:aws:execute-api:${arn.region}:${accountId}:${apiId}/${stage}/*/*`,
            ],
          },
        ],
      },
      context: {
        ...tenantScopeCredentials,
        userId: verifiedDecoded.sub,
        role: isValidAccountRoleName(role) ? role : 'user',
        verifiedEmail,
        tenantId,
        tenantName,
        encodedPermissions,
        auth0Domain,
      } as JWTAuthorizerResult as unknown as APIGatewayAuthorizerResultContext,
    }
  }
)
