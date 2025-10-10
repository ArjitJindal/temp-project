import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden } from 'http-errors'
import { stageAndRegion } from '@flagright/lib/utils'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { NangoService } from '../../services/nango'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { logger } from '@/core/logger'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { AccountsService } from '@/services/accounts'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import {
  sendInternalProxyWebhook,
  verifyInternalProxyWebhook,
} from '@/utils/internal-proxy'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export const webhooksHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { sourceIp } = event.requestContext.identity

    const handlers = new Handlers()

    /**
     * Auth0 webhook IPs
     */

    const AUTH0_ALLOWED_IPS = [
      '18.197.9.11',
      '18.198.229.148',
      '3.125.185.137',
      '3.65.249.224',
      '3.67.233.131',
      '3.68.125.137',
      '3.72.27.152',
      '3.74.90.247',
      '34.246.118.27',
      '35.157.198.116',
      '35.157.221.52',
      '52.17.111.199',
      '52.19.3.147',
      '52.208.95.174',
      '52.210.121.45',
      '52.210.122.50',
      '52.28.184.187',
      '52.30.153.34',
      '52.57.230.214',
      '54.228.204.106',
      '54.228.86.224',
      '54.73.137.216',
      '54.75.208.179',
      '54.76.184.103',
    ]

    handlers.registerPostWebhookAuth0(async (ctx, request) => {
      const webhookEvent = request.Auth0WebhookEvent
      if (!webhookEvent.logs) {
        logger.warn(`Received unhandled Auth0 webhook event: ${event.body}`)
        return
      }
      // check if bearer contains `somerandomstrig`
      const bearerToken = event.headers['Authorization'] || ''
      const token = bearerToken.split(' ')[1]

      if (token !== 'somerandomstring') {
        logger.error(`Invalid bearer token: ${token}`)
        throw new Forbidden('Invalid bearer token')
      }

      const isIpAllowed = AUTH0_ALLOWED_IPS.includes(sourceIp)

      if (!isIpAllowed) {
        logger.error(`IP ${sourceIp} is not authorized to make this request`)
        throw new Forbidden(
          `IP ${sourceIp} is not authorized to make this request`
        )
      }

      for (const log of webhookEvent.logs) {
        logger.info(`Received Auth0 webhook event: ${JSON.stringify(log)}`, {
          log,
        })
        if (!log.data?.tenant_name || !log.data?.user_name) {
          logger.warn(
            `Received unhandled Auth0 webhook event for unknown tenant or user: ${log.data?.tenant_name} ${log.data?.user_name}`
          )
          continue
        }

        const accountsService = new AccountsService(
          {
            auth0Domain: `${log.data.tenant_name}.eu.auth0.com`,
            useCache: true,
          },
          { dynamoDb: getDynamoDbClientByEvent(event) }
        )

        const account = await accountsService.getAccountByEmail(
          log.data.user_name
        )

        logger.info(`Account: ${account}`, { account })
        if (!account) {
          logger.warn(
            `Received unhandled Auth0 webhook event for unknown account: ${log.data.user_name}`
          )
          continue
        }

        const tenant = await accountsService.getAccountTenant(account.id)

        const tenantRepository = new TenantRepository(tenant.id, {
          dynamoDb: getDynamoDbClient(),
        })
        const tenantSettings = await tenantRepository.getTenantSettings()

        if (log.data.type !== 'limit_wc') {
          logger.info(`Skipping non-limit_wc webhook event: ${log.data.type}`)
          continue
        }

        // https://auth0.com/docs/deploy-monitor/logs/log-event-type-codes, search for limit_wc
        // An IP address is blocked because it reached the maximum failed login attempts into a single account.
        if (log.data.type === 'limit_wc') {
          if (!tenantSettings.bruteForceAccountBlockingEnabled) {
            try {
              // Brute force account blocking acutally disables you from IP so we need to unblock it
              await accountsService.unblockBruteForceAccount(account)
            } catch (error) {
              // handles cases when we are trying to unblock an account this is deleted
              logger.warn(
                `Unable to remove brute force blocking ${account.email} because of ${error}`
              )
            }
            continue
          }
          logger.info(
            `Skipping webhook event for tenant ${log.data.tenant_name} because brute force account blocking is disabled`
          )

          if (!account.blocked) {
            // only blocking the account if it's not already blocked
            // else we will get 400 error from auth0
            logger.info(`Blocking account ${account.email}`)
            await accountsService.blockAccountBruteForce(tenant, account)
          }
        }
      }
    })

    const NANGO_WEBHOOK_IPS = [
      '100.20.92.101',
      '44.225.181.72',
      '44.227.217.144',

      // New IPs
      '52.34.139.153',
      '54.69.127.183',
      '44.247.133.183',
      '52.26.211.56',
    ]

    handlers.registerPostWebhookNango(async (ctx, request) => {
      const isIpAllowed = NANGO_WEBHOOK_IPS.includes(sourceIp)

      if (!isIpAllowed) {
        throw new Forbidden(
          `IP ${sourceIp} is not authorized to make this request for Nango webhook`
        )
      }

      const dynamoDb = getDynamoDbClientByEvent(event)

      logger.info(`Received Nango webhook event: ${JSON.stringify(request)}`)

      const nangoService = new NangoService(FLAGRIGHT_TENANT_ID, dynamoDb)

      const { tenantId, region } = await nangoService.getConnectionMetadata(
        request.NangoWebhookEvent
      )

      const [_, currentRegion] = stageAndRegion()

      // if current region is not the same as the region of the webhook, we need to send a proxy webhook
      if (currentRegion !== region) {
        await sendInternalProxyWebhook(region as FlagrightRegion, {
          tenantId,
          type: 'NANGO_DATA_FETCH',
          webhookData: request.NangoWebhookEvent,
          region: region as FlagrightRegion,
        })
      } else {
        await sendBatchJobCommand({
          tenantId,
          type: 'NANGO_DATA_FETCH',
          parameters: {
            webhookData: request.NangoWebhookEvent,
            region,
          },
        })
      }

      return
    })

    handlers.registerPostWebhookInternalProxy(async (ctx, request) => {
      const { destinationRegion } = request.InternalProxyWebhookEvent
      const type = request.InternalProxyWebhookEvent.data.type
      const isValid = verifyInternalProxyWebhook(
        event.headers,
        request.InternalProxyWebhookEvent
      )
      if (!isValid) {
        throw new Forbidden(`Invalid signature for internal proxy webhook`)
      }

      switch (type) {
        case 'NANGO_DATA_FETCH': {
          await sendBatchJobCommand({
            tenantId: request.InternalProxyWebhookEvent.data.tenantId,
            type: 'NANGO_DATA_FETCH',
            parameters: {
              webhookData: request.InternalProxyWebhookEvent.data.webhookData,
              region: destinationRegion,
            },
          })
          break
        }

        case 'ACCOUNTS_REFRESH': {
          await sendBatchJobCommand({
            tenantId: FLAGRIGHT_TENANT_ID,
            type: 'SYNC_AUTH0_DATA',
            parameters: {
              type: 'ALL',
            },
          })
          break
        }
      }
    })

    return await handlers.handle(event)
  }
)
