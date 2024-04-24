import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { MerchantMonitoringScrapeService } from '@/services/merchant-monitoring/merchant-monitoring-scrape'
import { UserService } from '@/services/users'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { MerchantMonitoringRetrieve } from '@/services/merchant-monitoring/merchant-monitoring-retrieve'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const merchantMonitoringHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mms = await MerchantMonitoringScrapeService.init()
    const merchantMonitoringRetrieveService = new MerchantMonitoringRetrieve(
      tenantId,
      { mongoDb: await getMongoDbClient() }
    )
    const userService = await UserService.fromEvent(event)

    const handlers = new Handlers()

    handlers.registerPostMerchantSummary(async (ctx, request) => {
      const { userId, refresh, source } =
        request.MerchantMonitoringSummaryRequest
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
        (source?.sourceType === 'SCRAPE'
          ? source?.sourceValue
          : domain) as string,
        {
          onlyTypes:
            source && source.sourceType ? [source.sourceType] : undefined,
          refresh: refresh as boolean,
        }
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
        data: await merchantMonitoringRetrieveService.getMerchantMonitoringHistory(
          source,
          userId
        ),
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

    handlers.registerPostUpdateMonitoringStatus(async (ctx, request) => {
      await userService.updateMointoringStatus(
        request.userId,
        request.UpdateMonitoringStatusRequest.isMonitoringEnabled
      )
    })

    handlers.registerGetMerchantMonitoringStats(async () => {
      const count = await userService.getTotalEnabledOngoingMonitoringUsers()
      return { count }
    })
    return await handlers.handle(event)
  }
)
