import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { NarrativeService } from './services/narrative-template-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { NarrativeTemplateRequest } from '@/@types/openapi-internal/NarrativeTemplateRequest'
import { NarrativeTemplateResponse } from '@/@types/openapi-internal/NarrativeTemplateResponse'

export const narrativeTemplateHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const narrativeService = new NarrativeService(tenantId, mongoDb)

    if (event.resource.endsWith('/narrative-templates')) {
      if (event.httpMethod === 'GET' && event.queryStringParameters) {
        const { page, pageSize } = event.queryStringParameters as any

        return (await narrativeService.getNarrativeTemplates({
          page,
          pageSize,
        })) as NarrativeTemplateResponse
      }
    } else if (
      event.resource.endsWith('/narrative-template/{narrativeTemplateId}')
    ) {
      const narrativeTemplateId = event.pathParameters
        ?.narrativeTemplateId as string

      if (!narrativeTemplateId) {
        throw new BadRequest('NarrativeTemplate ID is required')
      }

      if (event.httpMethod === 'GET') {
        return await narrativeService.getNarrativeTemplate(narrativeTemplateId)
      } else if (event.httpMethod === 'PUT' && event.body) {
        const narrative = JSON.parse(event.body) as NarrativeTemplateRequest
        return await narrativeService.updateNarrativeTemplate(
          narrativeTemplateId,
          narrative
        )
      } else if (event.httpMethod === 'DELETE') {
        return await narrativeService.deleteNarrativeTemplate(
          narrativeTemplateId
        )
      }
    } else if (event.resource.endsWith('/narrative-template')) {
      if (event.httpMethod === 'POST' && event.body) {
        const narrative = JSON.parse(event.body) as NarrativeTemplateRequest

        return await narrativeService.createNarrativeTemplate(narrative)
      }
    }

    throw new BadRequest('Invalid request')
  }
)
