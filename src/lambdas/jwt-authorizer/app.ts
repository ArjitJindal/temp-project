import * as AWS from 'aws-sdk'
import * as ARN from '@aws-sdk/util-arn-parser'

import {
  APIGatewayAuthorizerResult,
  APIGatewayAuthorizerResultContext,
  APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { TarponStackConstants } from '../../../lib/constants'
import PolicyBuilder from '../../core/policies/policy-generator'

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  userId: string
  tenantName: string
}

const AUTH0_CUSTOM_CLAIMS_NAMESPACE = 'https://flagright.com'

const jwtOptions = {
  audience: process.env.AUTH0_AUDIENCE,
  issuer: process.env.AUTH0_TOKEN_ISSUER,
}

const jwks = jwksClient({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Default value
  jwksUri: process.env.AUTH0_JWKS_URI!,
})

async function getTenantScopeCredentials(
  tenantId: string,
  accountId: string,
  requestId: string
): Promise<AWS.STS.Credentials> {
  const sts = new AWS.STS()
  const assumeRoleResult = await sts
    .assumeRole({
      RoleArn: `arn:aws:iam::${accountId}:role/${TarponStackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME}`,
      RoleSessionName: requestId,
      Policy: JSON.stringify(
        new PolicyBuilder(tenantId)
          .s3()
          .dynamoDb(TarponStackConstants.DYNAMODB_TABLE_NAME)
          .build()
      ),
    })
    .promise()
  if (!assumeRoleResult.Credentials) {
    throw new Error('Got empty credentials from STS')
  }

  return assumeRoleResult.Credentials
}

const getToken = (event: APIGatewayRequestAuthorizerEvent) => {
  const token = event.headers?.['authorization']
  if (!token) {
    throw new Error('Expected "Authorization" header to be set')
  }

  const match = token.match(/^Bearer (.*)$/)
  if (!match || match.length < 2) {
    throw new Error(
      `Invalid Authorization token - ${token} does not match "Bearer .*"`
    )
  }
  return match[1]
}

export const jwtAuthorizer = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const arn = ARN.parse(event.methodArn)
  const { apiId, stage, accountId, requestId } = event.requestContext
  const token = getToken(event)
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('invalid token')
  }
  const key = await jwks.getSigningKey(decoded.header.kid)
  const signingKey = key.getPublicKey()
  const verifiedDecoded = jwt.verify(
    token,
    signingKey,
    jwtOptions
  ) as jwt.JwtPayload

  // TODO: Use role
  // const role = verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/role`]

  const tenantId = verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/tenantId`]
  const tenantName =
    verifiedDecoded[`${AUTH0_CUSTOM_CLAIMS_NAMESPACE}/tenantName`]
  const tenantScopeCredentials = await getTenantScopeCredentials(
    tenantId,
    accountId,
    requestId
  )

  return {
    principalId: tenantId,
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
      tenantName,
    } as JWTAuthorizerResult as unknown as APIGatewayAuthorizerResultContext,
  }
}
