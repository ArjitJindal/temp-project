import { URLSearchParams } from 'url'
import * as path from 'path'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  SQSEvent,
} from 'aws-lambda'
import * as ejs from 'ejs'
import { IncomingWebhook } from '@slack/webhook'
import { Credentials } from '@aws-sdk/client-sts'
import { OauthV2AccessResponse } from '@slack/web-api'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { AlertPayload } from '@/@types/alert/alert-payload'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { CaseRepository } from '@/services/cases/repository'
import { apiFetch } from '@/utils/api-fetch'

export const slackAppHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/slack/oauth_redirect'
    ) {
      const code = event.queryStringParameters?.['code'] as string
      const tenantId = event.queryStringParameters?.['state'] as string
      try {
        const response = (
          await apiFetch<OauthV2AccessResponse>(
            'https://slack.com/api/oauth.v2.access?' +
              new URLSearchParams({
                client_id: process.env.SLACK_CLIENT_ID as string,
                client_secret: process.env.SLACK_CLIENT_SECRET as string,
                redirect_uri: process.env.SLACK_REDIRECT_URI as string,
                code,
              })
          )
        ).result

        const slackWebhookURL = response?.incoming_webhook?.url
        if (!slackWebhookURL) {
          throw Error('Missing webhook url')
        }

        const mongoDb = await getMongoDbClient()
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

export const slackAlertHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  for (const record of event.Records) {
    const payload = JSON.parse(record.body) as AlertPayload
    if (payload.kind === 'NEW_CASE') {
      const { tenantId, caseId } = payload
      const tenantRepository = new TenantRepository(tenantId, {
        mongoDb,
        dynamoDb,
      })
      const slackWebhook = await tenantRepository.getTenantMetadata(
        'SLACK_WEBHOOK'
      )
      if (!slackWebhook) {
        continue
      }

      const caseRepository = new CaseRepository(tenantId, {
        mongoDb,
      })
      const caseItem = await caseRepository.getCaseById(caseId)

      if (caseId) {
        const webhook = new IncomingWebhook(slackWebhook.slackWebhookURL)
        logger.info(
          `Sending case Slack alert: tenant=${tenantId}, caseId=${caseId}`
        )
        await webhook.send({
          text: 'New case created',
          attachments: [
            {
              color: '#ffa500', // orange
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text:
                      `<${process.env.CONSOLE_URI}/case-management/case/${caseId}|${caseId}>\n` +
                      '*status:*\n' +
                      `${caseItem?.caseStatus}`,
                  },
                },
              ],
            },
          ],
        })
      }
    }
  }
})
