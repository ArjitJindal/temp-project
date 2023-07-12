import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { MerchantMonitoringService } from '@/services/merchant-monitoring'
import { MerchantMonitoringSummaryRequest } from '@/@types/openapi-internal/MerchantMonitoringSummaryRequest'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { MerchantMonitoringScrapeRequest } from '@/@types/openapi-internal/MerchantMonitoringScrapeRequest'

export const merchantMonitoringHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mms = await MerchantMonitoringService.init()
    const userService = await UserService.fromEvent(event)

    if (event.httpMethod === 'POST' && event.body) {
      const { userId, refresh }: MerchantMonitoringSummaryRequest = JSON.parse(
        event.body
      )
      const user = await userService.getBusinessUser(userId as string)
      const domain = user?.legalEntity.contactDetails?.websites
        ? (user.legalEntity?.contactDetails?.websites[0] as string)
        : undefined
      const name = user?.legalEntity.companyGeneralDetails.legalName

      if (event.path.endsWith('/summary')) {
        const summaries = await mms.getMerchantMonitoringSummaries(
          tenantId,
          userId as string,
          name as string,
          domain as string,
          refresh
        )
        return {
          data: summaries,
        }
      }

      if (event.path.endsWith('/history')) {
        const { source }: MerchantMonitoringSummaryRequest = JSON.parse(
          event.body
        )
        return {
          data: await mms.getMerchantMonitoringHistory(
            tenantId,
            source as MerchantMonitoringSource,
            userId as string
          ),
        }
      }
      if (event.path.endsWith('/scrape')) {
        const { url }: MerchantMonitoringScrapeRequest = JSON.parse(event.body)
        return await mms.scrapeMerchantMonitoringSummary(
          tenantId,
          userId as string,
          name as string,
          url as string
        )
      }
    }
  }
)
