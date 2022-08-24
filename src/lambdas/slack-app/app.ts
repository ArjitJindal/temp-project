import { URLSearchParams } from 'url'
import * as path from 'path'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  SQSEvent,
} from 'aws-lambda'

import fetch from 'node-fetch'
import * as ejs from 'ejs'
import { IncomingWebhook } from '@slack/webhook'
import AWS from 'aws-sdk'
import { OauthV2AccessResponse } from '@slack/web-api'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { connectToDB } from '@/utils/mongoDBUtils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { AlertPayload } from '@/@types/alert/alert-payload'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { logger } from '@/core/logger'

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
        const response = (await (
          await fetch(
            'https://slack.com/api/oauth.v2.access?' +
              new URLSearchParams({
                client_id: process.env.SLACK_CLIENT_ID as string,
                client_secret: process.env.SLACK_CLIENT_SECRET as string,
                redirect_uri: process.env.SLACK_REDIRECT_URI as string,
                code,
              })
          )
        ).json()) as OauthV2AccessResponse
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

const DANGER_COLOR_STATUSES: RuleAction[] = ['BLOCK', 'SUSPEND']

export const slackAlertHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const mongoDb = await connectToDB()
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  for (const record of event.Records) {
    const { tenantId, transactionId } = JSON.parse(record.body) as AlertPayload
    const tenantRepository = new TenantRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb,
    })
    const slackWebhook = await tenantRepository.getTenantMetadata(
      'SLACK_WEBHOOK'
    )
    if (!slackWebhook) {
      continue
    }

    if (transactionId) {
      const settings = await tenantRepository.getTenantSettings([
        'ruleActionAliases',
      ])
      const transaction =
        await transactionRepository.getTransactionCaseManagement(transactionId)
      const statusAlias = settings?.ruleActionAliases?.find(
        (alias) => alias.action === transaction?.status
      )?.alias
      const webhook = new IncomingWebhook(slackWebhook.slackWebhookURL)
      logger.info(
        `Sending Slack alert: tenant=${tenantId}, transactionId=${transactionId}`
      )
      await webhook.send({
        text: 'New case created',
        attachments: [
          {
            color: DANGER_COLOR_STATUSES.includes(
              transaction?.status as RuleAction
            )
              ? '#ff0000' // red
              : '#ffa500', // orange
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text:
                    `<${process.env.CONSOLE_URI}/case-management/case/${transactionId}|${transactionId}>\n` +
                    '*status*\n' +
                    `${statusAlias || transaction?.status}`,
                },
              },
            ],
          },
        ],
      })
    }
  }
})
