import { URLSearchParams } from 'url'
import * as path from 'path'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

import fetch from 'node-fetch'
import * as ejs from 'ejs'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { connectToDB } from '@/utils/mongoDBUtils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

export const slackAppHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/slack/oauth_redirect'
    ) {
      const code = event.queryStringParameters?.['code'] as string
      const tenantId = event.queryStringParameters?.['state'] as string
      try {
        const response = await (
          await fetch(
            'https://slack.com/api/oauth.v2.access?' +
              new URLSearchParams({
                client_id: process.env.SLACK_CLIENT_ID as string,
                client_secret: process.env.SLACK_CLIENT_SECRET as string,
                redirect_uri: process.env.SLACK_REDIRECT_URI as string,
                code,
              })
          )
        ).json()
        const slackWebhookURL = response?.incoming_webhook?.url
        if (!slackWebhookURL) {
          throw Error('Missing webhook url')
        }

        const mongoDb = await connectToDB()
        const tenantRepository = new TenantRepository(tenantId, { mongoDb })
        await tenantRepository.createOrUpdateTenantMetadata('SLACK_WEBHOOK', {
          slackWebhookURL,
          originalResponse: response,
        })

        const html = await ejs.renderFile(
          path.join(__dirname, 'templates', 'success.ejs'),
          {
            channel: response?.incoming_webhook?.channel,
            configurationUrl: response?.incoming_webhook?.configuration_url,
          }
        )
        return {
          headers: {
            'Content-Type': 'text/html',
          },
          body: html,
        }
      } catch (e) {
        const html = await ejs.renderFile(
          path.join(__dirname, 'templates', 'failure.ejs'),
          {
            error: process.env.ENV === 'dev' ? (e as Error) : '',
          }
        )
        return {
          headers: {
            'Content-Type': 'text/html',
          },
          body: html,
        }
      }
    }
    throw new Error('Unhandled request')
  }
)
