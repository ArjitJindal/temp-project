import * as ARN from '@aws-sdk/util-arn-parser'
import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayAuthorizerResult,
  APIGatewayAuthorizerResultContext,
  APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import PolicyBuilder from '@/core/policies/policy-generator'
import { lambdaAuthorizer } from '@/core/middlewares/lambda-authorizer-middlewares'
import { updateLogMetadata } from '@/core/utils/context'
import { addNewSubsegment } from '@/core/xray'
import { logger } from '@/core/logger'

async function getTenantScopeCredentials(
  tenantId: string,
  accountId: string,
  requestId: string
): Promise<Credentials> {
  const subgement = await addNewSubsegment(
    'apiKeyAuthorizer',
    'getTenantScopeCredentials'
  )
  const sts = new STSClient({
    region: process.env.AWS_REGION,
  })

  const command = new AssumeRoleCommand({
    RoleArn: process.env.AUTHORIZER_BASE_ROLE_ARN as string,
    RoleSessionName: requestId,
    Policy: JSON.stringify(
      new PolicyBuilder(tenantId)
        .dynamoDb([
          StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
          StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        ])
        .build()
    ),
    DurationSeconds: StackConstants.API_KEY_AUTHORIZER_CACHE_TTL_SECONDS,
  })

  const assumeRoleResult = await sts.send(command)

  if (!assumeRoleResult.Credentials) {
    const err = new Error('Got empty credentials from STS')
    subgement?.close(err)
    throw err
  }

  subgement?.close()
  return assumeRoleResult.Credentials
}

function getTenantIdFromApiKey(apiKey: string): string | null {
  let decodedApiKey = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const base62 = require('base-x')(
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    )
    decodedApiKey = base62.decode(apiKey).toString()
  } catch (e) {
    logger.warn(`Failed to decode API key: ${(e as Error)?.message}`, {
      apiKey,
    })
    return null
  }
  if (!decodedApiKey.match(/\w+\.\w+/)) {
    logger.warn("The decoded API key doesn't match the pattern", { apiKey })
    return null
  }
  return decodedApiKey.split('.')[0] ?? null
}

export const apiKeyAuthorizer = lambdaAuthorizer()(
  async (
    event: APIGatewayRequestAuthorizerEvent
  ): Promise<APIGatewayAuthorizerResult> => {
    const arn = ARN.parse(event.methodArn)
    const { apiId, stage, accountId, requestId } = event.requestContext
    const apiKey = event.headers?.['x-api-key']
    const tenantId = apiKey ? getTenantIdFromApiKey(apiKey) : undefined

    // NOTE: "Surprisingly", if the api key is invalid, lambda authorizer will still be executed, and
    // the api key will be validated after lambda authorizer returns.
    // To avoid error in case of invalid api key, we early return if we cannot decode the api key.
    if (!apiKey || !tenantId) {
      if (!apiKey) {
        logger.warn('x-api-key header is missing')
      }
      if (!tenantId) {
        logger.warn('Empty tenant ID', { apiKey })
      }

      return {
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
        usageIdentifierKey: apiKey,
      }
    }

    updateLogMetadata({
      tenantId,
      apiKeySuffix: apiKey?.substring(apiKey.length - 5),
    })

    const tenantScopeCredentials = await getTenantScopeCredentials(
      tenantId,
      accountId,
      requestId
    )
    logger.info('Successfully authorized')

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
)
