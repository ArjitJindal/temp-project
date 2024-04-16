import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

import { Credentials } from '@aws-sdk/client-sts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { SanctionsSearch } from '@/@types/openapi-public-sanctions/SanctionsSearch'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchUpdateRequest } from '@/@types/openapi-public-sanctions/SanctionsSearchUpdateRequest'
import dayjs from '@/utils/dayjs'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

function internalToPublicSearchResult(
  searchResult: SanctionsSearchHistory
): SanctionsSearch {
  return {
    searchId: searchResult._id,
    createdAt: dayjs(
      searchResult.response?.rawComplyAdvantageResponse?.content?.data
        ?.created_at
    ).valueOf(),
    updatedAt: dayjs(
      searchResult.response?.rawComplyAdvantageResponse?.content?.data
        ?.updated_at
    ).valueOf(),
    request: searchResult.request.apiSearchRequest ?? searchResult.request,
    response: searchResult.response?.rawComplyAdvantageResponse?.content?.data,
  }
}

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const sanctionsService = new SanctionsService(tenantId)
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/searches' &&
      event.body
    ) {
      const searchRequest = JSON.parse(event.body) as SanctionsSearchRequest
      if (!searchRequest.searchTerm) {
        throw new BadRequest(`Search term must be provided`)
      }
      const searchTerm = searchRequest.searchTerm
      const countryCodes = searchRequest.countryCodes

      const searchResult = await sanctionsService.search({
        searchTerm: searchTerm,
        yearOfBirth: searchRequest.yearOfBirth,
        countryCodes: countryCodes,
        fuzziness: searchRequest.fuzziness,
        types: searchRequest.types,
        apiSearchRequest: searchRequest,
        monitoring: searchRequest.monitoring,
      })
      const searchHistory = await sanctionsService.getSearchHistory(
        searchResult.searchId
      )
      if (!searchHistory) throw Error('No search history found')
      return internalToPublicSearchResult(searchHistory)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/searches/{searchId}' &&
      event.pathParameters?.searchId
    ) {
      const { searchId } = event.pathParameters
      const searchResult = await sanctionsService.getSearchHistory(searchId)
      if (!searchResult) {
        throw new NotFound(
          `Unable to find search history by searchId=${searchId}`
        )
      }
      return internalToPublicSearchResult(searchResult)
    } else if (
      event.httpMethod === 'PATCH' &&
      event.resource === '/searches/{searchId}' &&
      event.pathParameters?.searchId &&
      event.body
    ) {
      const updateRequest = JSON.parse(
        event.body
      ) as SanctionsSearchUpdateRequest
      await sanctionsService.updateSearch(
        event.pathParameters.searchId,
        updateRequest.monitoring
      )
      return 'OK'
    }
    throw new Error('Unhandled request')
  }
)
