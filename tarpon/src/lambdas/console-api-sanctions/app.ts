import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const sanctionsService = new SanctionsService(tenantId)
    const handlers = new Handlers()

    handlers.registerPostSanctions(
      async (ctx, request) =>
        await sanctionsService.search(request.SanctionsSearchRequest)
    )

    handlers.registerGetSanctionsSearch(
      async (ctx, request) => await sanctionsService.getSearchHistories(request)
    )

    handlers.registerGetSanctionsSearchSearchId(
      async (ctx, request) =>
        await sanctionsService.getSearchHistory(request.searchId)
    )

    handlers.registerPostSanctionsWhitelist(async (ctx, _request) => {
      const request = _request.SanctionsWhitelistRequest
      if (request.whitelisted) {
        const search = await sanctionsService.getSearchHistory(request.searchId)
        const entities = search?.response?.data
          .map((v) => v?.doc)
          .filter((entity) =>
            request.caEntityIds.includes(entity?.id as string)
          ) as ComplyAdvantageSearchHitDoc[]
        await sanctionsService.addWhitelistEntities(entities, request.userId, {
          reason: request.reason,
          comment: request.comment,
        })
      } else {
        await sanctionsService.removeWhitelistEntities(
          request.caEntityIds,
          request.userId
        )
      }
    })

    handlers.registerGetSanctionsScreeningActivityStats(
      async (_ctx, request) => {
        if (!request.afterTimestamp || !request.beforeTimestamp) {
          return await sanctionsService.getSanctionsScreeningStats()
        }

        return await sanctionsService.getSanctionsScreeningStats({
          from: request.afterTimestamp,
          to: request.beforeTimestamp,
        })
      }
    )

    handlers.registerGetSanctionsScreeningActivityDetails(
      async (_ctx, request) => {
        return await sanctionsService.getSanctionsScreeningDetails(request)
      }
    )

    return await handlers.handle(event)
  }
)
