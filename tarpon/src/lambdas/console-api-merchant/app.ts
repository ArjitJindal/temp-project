import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { MerchantMonitoringService } from '@/services/merchant-monitoring'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

export const merchantMonitoringHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mms = await MerchantMonitoringService.init()
    const userService = await UserService.fromEvent(event)

    const handlers = new Handlers()

    handlers.registerPostMerchantSummary(async (ctx, request) => {
      const { userId, refresh } = request.MerchantMonitoringSummaryRequest
      if (!userId) {
        throw new BadRequest('Missing userId')
      }
      const user = await userService.getBusinessUser(userId)
      const domain = user?.legalEntity.contactDetails?.websites
        ? (user.legalEntity?.contactDetails?.websites[0] as string)
        : undefined
      const name = user?.legalEntity.companyGeneralDetails.legalName
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
    })

    handlers.registerPostMerchantHistory(async (ctx, request) => {
      const { userId, source } = request.MerchantMonitoringSummaryRequest
      if (!userId || !source) {
        throw new BadRequest('Missing userId or source')
      }
      return {
        data: await mms.getMerchantMonitoringHistory(tenantId, source, userId),
      }
    })

    handlers.registerPostMerchantScrape(async (ctx, request) => {
      const { userId, url } = request.MerchantMonitoringScrapeRequest
      if (!userId || !url) {
        throw new BadRequest('Missing userId or url')
      }
      const user = await userService.getBusinessUser(userId as string)
      const name = user?.legalEntity.companyGeneralDetails.legalName
      return await mms.scrapeMerchantMonitoringSummary(
        tenantId,
        userId as string,
        name as string,
        url as string
      )
    })

    return await handlers.handle(event)
  }
)
