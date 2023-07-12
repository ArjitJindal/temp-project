import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsService } from '@/services/sanctions'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsWhitelistRequest } from '@/@types/openapi-internal/SanctionsWhitelistRequest'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const sanctionsService = new SanctionsService(tenantId)
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/sanctions/search' &&
      event.body
    ) {
      const searchRequest = JSON.parse(event.body) as SanctionsSearchRequest
      return sanctionsService.search(searchRequest)
    }

    if (event.httpMethod === 'GET' && event.resource === '/sanctions/search') {
      const q = event.queryStringParameters as any
      const params: DefaultApiGetSanctionsSearchRequest = {
        page: q.page,
        pageSize: q.pageSize,
        beforeTimestamp: parseInt(q.beforeTimestamp),
        afterTimestamp: parseInt(q.afterTimestamp),
        searchTerm: q.searchTerm,
        types: q.types ? q.types.split(',') : [],
      }
      return sanctionsService.getSearchHistories(params)
    }

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/sanctions/search/{searchId}' &&
      event.pathParameters?.searchId
    ) {
      const { searchId } = event.pathParameters
      const { userId } = event.queryStringParameters ?? {}
      const search = await sanctionsService.getSearchHistory(searchId, userId)
      if (!search) {
        throw new NotFound(
          `Unable to find search history by searchId=${searchId}`
        )
      }
      return search
    }

    if (
      event.httpMethod === 'POST' &&
      event.resource === '/sanctions/whitelist' &&
      event.body
    ) {
      const request = JSON.parse(event.body) as SanctionsWhitelistRequest

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
      return
    }
    throw new Error('Unhandled request')
  }
)
