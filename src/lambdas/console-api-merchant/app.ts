import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { MerchantMonitoringService } from '@/services/merchant-monitoring'
import { MerchantMonitoringSummaryRequest } from '@/@types/openapi-internal/MerchantMonitoringSummaryRequest'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'

export const merchantMonitoringHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/summary') &&
      event.body
    ) {
      const { domain, name, refresh }: MerchantMonitoringSummaryRequest =
        JSON.parse(event.body)
      const { principalId: tenantId } = event.requestContext.authorizer
      const mms = new MerchantMonitoringService()
      return {
        data: await mms.getMerchantMonitoringSummaries(
          tenantId,
          name as string,
          domain as string,
          refresh
        ),
      }
    }

    if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/history') &&
      event.body
    ) {
      const { domain, name, source }: MerchantMonitoringSummaryRequest =
        JSON.parse(event.body)
      const mms = new MerchantMonitoringService()
      return {
        data: await mms.getMerchantMonitoringHistory(
          source as MerchantMonitoringSource,
          name as string,
          domain as string
        ),
      }
    }

    if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/scrape') &&
      event.body
    ) {
      const { domain, name }: MerchantMonitoringSummaryRequest = JSON.parse(
        event.body
      )
      const mms = new MerchantMonitoringService()
      return await mms.scrapeMerchantMonitoringSummary(
        name as string,
        domain as string
      )
    }
  }
)
