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
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

const COMPLYADVANTAGE_PRODUCTION_IPS = [
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

export const webhooksHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { sourceIp } = event.requestContext.identity

    const handlers = new Handlers()

    handlers.registerPostWebhookComplyAdvantage(async (ctx, request) => {
      if (process.env.ENV === 'prod') {
        if (!COMPLYADVANTAGE_PRODUCTION_IPS.includes(sourceIp)) {
          logger.error(`${sourceIp} is not authorized to make this request`)
          throw new Forbidden(
            `${sourceIp} is not authorized to make this request`
          )
        }
      }
      const webhookEvent = request.ComplyAdvantageWebhookEvent
      if (webhookEvent.event === 'monitored_search_updated') {
        const searchUpdated =
          webhookEvent.data as ComplyAdvantageMonitoredSearchUpdated
        logger.info(
          `Received ComplyAdvantage webhook event 'monitored_search_updated' (search ID: ${searchUpdated.searchId})`
        )
        const allTenants = await TenantService.getAllTenants()
        for (const t of allTenants) {
          const searchId = searchUpdated.searchId as number
          const sanctionsService = new SanctionsService(t.tenant.id)
          await sanctionsService.updateMonitoredSearch(searchId)
        }
      } else {
        logger.error(
          `Received unhandled ComplyAdvantage webhook event: ${event.body}`
        )
      }
      return
    })

    return await handlers.handle(event)
  }
)
