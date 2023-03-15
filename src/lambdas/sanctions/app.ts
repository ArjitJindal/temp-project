import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsService } from '@/services/sanctions'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

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
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      const settings = await tenantRepository.getTenantSettings()
      return sanctionsService.search(
        searchRequest,
        settings.complyAdvantageSearchProfileId
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/sanctions/search'
    ) {
      const q = event.queryStringParameters as any
      const params: DefaultApiGetSanctionsSearchRequest = {
        page: q.page,
        pageSize: q.pageSize,
      }
      return sanctionsService.getSearchHistory(params)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/sanctions/search/{searchId}' &&
      event.pathParameters?.searchId
    ) {
      return sanctionsService.getSearchResult(event.pathParameters.searchId)
    }
    throw new Error('Unhandled request')
  }
)
