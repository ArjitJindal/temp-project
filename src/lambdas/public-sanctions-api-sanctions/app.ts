import { BadRequest } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import _ from 'lodash'
import dayjs from 'dayjs'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsService } from '@/services/sanctions'
import { SanctionsBankSearchRequest } from '@/@types/openapi-public-sanctions/SanctionsBankSearchRequest'
import { SanctionsSearch } from '@/@types/openapi-public-sanctions/SanctionsSearch'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchUpdateRequest } from '@/@types/openapi-public-sanctions/SanctionsSearchUpdateRequest'
import { SanctionsSearchType } from '@/@types/openapi-public-sanctions/SanctionsSearchType'

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

function pickSearchProfileId(types?: SanctionsSearchType[]): string {
  if (process.env.ENV !== 'prod') {
    return ''
  }
  if (_.isEqual(types, ['SANCTIONS'] as SanctionsSearchType[])) {
    return '01c3b373-c01a-48b2-96f7-3fcf17dd0c91'
  } else if (_.isEqual(types, ['SANCTIONS', 'PEP'] as SanctionsSearchType[])) {
    return '8b51ca9d-4b45-4de7-bac8-3bebcf6041ab'
  } else if (
    _.isEqual(types, ['SANCTIONS', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
  ) {
    return '919d1abb-2add-46c1-b73a-0fbae79aee6d'
  } else if (_.isEqual(types, ['PEP'] as SanctionsSearchType[])) {
    return 'a9b22101-e5d5-477c-b2c7-2f875ebbd5d8'
  } else if (
    _.isEqual(types, ['PEP', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
  ) {
    return 'e04c41ad-d3f0-4562-9b51-9d00a8965f16'
  } else if (_.isEqual(types, ['ADVERSE_MEDIA'] as SanctionsSearchType[])) {
    return '5a67aa5f-4ec8-4a61-af3a-78e3c132a24d'
  }
  return '15cb1d65-7f06-4eb3-84f5-f0cb9f1d4c8f'
}

export const sanctionsHandler = lambdaApi({ requiredFeatures: ['SANCTIONS'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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

      const searchResult = await sanctionsService.search(
        {
          searchTerm: bankName,
          countryCodes: countryCodes,
          fuzziness: searchRequest.fuzziness,
          types: searchRequest.types,
          apiSearchRequest: searchRequest,
          monitoring: searchRequest.monitoring,
        },
        pickSearchProfileId(searchRequest.types)
      )
      return internalToPublicSearchResult(
        await sanctionsService.getSearchHistory(searchResult.searchId)
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/searches/{searchId}' &&
      event.pathParameters?.searchId
    ) {
      const searchResult = await sanctionsService.getSearchHistory(
        event.pathParameters?.searchId
      )
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
