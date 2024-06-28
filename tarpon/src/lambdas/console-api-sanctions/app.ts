import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { DefaultApiSearchSanctionsHitsRequest } from '@/@types/openapi-internal/RequestParameters'
import { AlertsService } from '@/services/alerts'

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const sanctionsService = new SanctionsService(tenantId)
    const alertsServicePromise = AlertsService.fromEvent(event)
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

    handlers.registerSearchSanctionsHits(
      async (_ctx, request: DefaultApiSearchSanctionsHitsRequest) => {
        return await sanctionsService.searchHits({
          ...request,
          pageSize: request.pageSize,
          fromCursorKey: request.start,
          sortField: request.sortField,
          sortOrder: request.sortOrder,
        })
      }
    )

    handlers.registerChangeSanctionsHitsStatus(
      async (_ctx, { SanctionHitsStatusUpdateRequest }) => {
        const { alertId, sanctionHitIds, updates } =
          SanctionHitsStatusUpdateRequest
        const { whitelistHits } = updates
        const result = await sanctionsService.updateHits(
          sanctionHitIds,
          updates
        )
        const alertsService = await alertsServicePromise

        let commentBody = `${sanctionHitIds.join(', ')} hits are moved to "${
          updates.status
        }" status`
        const reasonsComment = AlertsService.formatReasonsComment(updates)
        if (reasonsComment !== '') {
          commentBody += `. Reasons: ` + reasonsComment
        }
        if (updates?.comment) {
          commentBody += `\n\n${updates.comment}`
        }
        await alertsService.saveComment(alertId, {
          body: commentBody,
          files: updates.files,
        })

        if (updates.status === 'CLEARED' && whitelistHits) {
          for await (const hit of sanctionsService.sanctionsHitsRepository.iterateHits(
            {
              filterIds: sanctionHitIds,
            }
          )) {
            if (
              hit.hitContext &&
              hit.hitContext.userId != null &&
              hit.caEntity
            ) {
              await sanctionsService.addWhitelistEntities(
                [hit.caEntity],
                hit.hitContext.userId,
                {
                  reason: reasonsComment,
                  comment: updates.comment,
                }
              )
            }
          }
        }

        return result
      }
    )

    return await handlers.handle(event)
  }
)
