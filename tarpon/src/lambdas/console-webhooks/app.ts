import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { TenantService } from '@/services/tenants'
import { logger } from '@/core/logger'
import { ComplyAdvantageMonitoredSearchUpdated } from '@/@types/openapi-internal/ComplyAdvantageMonitoredSearchUpdated'
import { ComplyAdvantageWebhookEvent } from '@/@types/openapi-internal/ComplyAdvantageWebhookEvent'

export const webhooksHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { sourceIp } = event.requestContext.identity
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/webhooks/complyadvantage' &&
      event.body
    ) {
      // Check source IPs in production
      if (process.env.ENV === 'prod') {
        const complyAdvantageIPs = [
          '54.76.153.128',
          '52.19.50.164',
          '18.200.42.250',
          '3.216.162.15',
          '3.214.3.128',
          '52.73.76.4',
          '3.105.135.152',
          '54.79.153.96',
          '52.63.190.126',
        ]
        if (!complyAdvantageIPs.includes(sourceIp)) {
          logger.error(`${sourceIp} is not authorized to make this request`)
          throw new Forbidden(
            `${sourceIp} is not authorized to make this request`
          )
        }
      }
      const webhookEvent = JSON.parse(event.body) as ComplyAdvantageWebhookEvent
      if (webhookEvent.event === 'monitored_search_updated') {
        const searchUpdated =
          webhookEvent.data as ComplyAdvantageMonitoredSearchUpdated
        logger.info(
          `Received ComplyAdvantage webhook event 'monitored_search_updated' (search ID: ${searchUpdated.search_id})`
        )
        const allTenants = await TenantService.getAllTenants()
        for (const t of allTenants) {
          const searchId = searchUpdated.search_id as number
          const sanctionsService = new SanctionsService(t.tenant.id)
          await sanctionsService.updateMonitoredSearch(searchId)
        }
      } else {
        logger.error(
          `Received unhandled ComplyAdvantage webhook event: ${event.body}`
        )
      }
      return 'OK'
    }
    throw new Error('Unhandled request')
  }
)
