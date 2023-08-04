import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import _ from 'lodash'
import { Credentials } from '@aws-sdk/client-sts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { SanctionsBankSearchRequest } from '@/@types/openapi-public-sanctions/SanctionsBankSearchRequest'
import { SanctionsSearch } from '@/@types/openapi-public-sanctions/SanctionsSearch'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchUpdateRequest } from '@/@types/openapi-public-sanctions/SanctionsSearchUpdateRequest'
import dayjs from '@/utils/dayjs'

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
      event.resource === '/searches/bank' &&
      event.body
    ) {
      const searchRequest = JSON.parse(event.body) as SanctionsBankSearchRequest
      if (!searchRequest.bankName && !searchRequest.iban) {
        throw new BadRequest(
          `At least one of 'bankName' or 'iban' needs to be provided`
        )
      }
      const bankName = searchRequest.bankName || ''
      const countryCodes = searchRequest.countryCodes
      if (!searchRequest.bankName) {
        // TODO: resolve bank name and country code from searchRequest.iban
        // https://www.notion.so/flagright/IBAN-com-integration-756aa106dd924212a204f1e32674db93
      }
      if (!bankName) {
        throw new Error('Bank name cannot be empty')
      }

      const searchResult = await sanctionsService.search({
        searchTerm: bankName,
        countryCodes: countryCodes,
        fuzziness: searchRequest.fuzziness,
        types: searchRequest.types,
        apiSearchRequest: searchRequest,
        monitoring: searchRequest.monitoring,
      })
      return internalToPublicSearchResult(
        (await sanctionsService.getSearchHistory(searchResult.searchId))!
      )
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
