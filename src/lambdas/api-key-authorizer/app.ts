import * as AWS from 'aws-sdk'
import * as ARN from '@aws-sdk/util-arn-parser'

import {
  APIGatewayAuthorizerResult,
  APIGatewayAuthorizerResultContext,
  APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda'
import { TarponStackConstants } from '@cdk/constants'
import PolicyBuilder from '@/core/policies/policy-generator'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base62 = require('base-x')(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

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

function getTenantIdFromApiKey(apiKey: string) {
  return base62.decode(apiKey).toString().split('.')[0]
}

export const apiKeyAuthorizer = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const arn = ARN.parse(event.methodArn)
  const { apiId, stage, accountId, requestId } = event.requestContext
  const apiKey = event.headers?.['x-api-key']
  if (!apiKey) {
    throw new Error('x-api-key header is missing')
  }

  const tenantId = getTenantIdFromApiKey(apiKey)
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
    context:
      tenantScopeCredentials as unknown as APIGatewayAuthorizerResultContext,
    usageIdentifierKey: apiKey,
  }
}
