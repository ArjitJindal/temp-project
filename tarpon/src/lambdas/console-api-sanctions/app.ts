import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsService } from '@/services/sanctions'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'

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
        // TODO: add date after & before properties
        page: q.page,
        pageSize: q.pageSize,
        beforeTimestamp: parseInt(q.beforeTimestamp),
        afterTimestamp: parseInt(q.afterTimestamp),
      }
      return sanctionsService.getSearchHistories(params)
    }

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/sanctions/search/{searchId}' &&
      event.pathParameters?.searchId
    ) {
      return sanctionsService.getSearchHistory(event.pathParameters.searchId)
    }
    throw new Error('Unhandled request')
  }
)
