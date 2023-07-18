import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NarrativeService } from './services/narrative-template-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

export const narrativeTemplateHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const narrativeService = new NarrativeService(tenantId, mongoDb)

    const handlers = new Handlers()

    handlers.registerGetNarratives(
      async (ctx, request) =>
        await narrativeService.getNarrativeTemplates({
          page: request.page,
          pageSize: request.pageSize,
        })
    )

    handlers.registerGetNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.getNarrativeTemplate(request.narrativeTemplateId)
    )

    handlers.registerPutNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.updateNarrativeTemplate(
          request.narrativeTemplateId,
          request.NarrativeTemplateRequest
        )
    )

    handlers.registerDeleteNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.deleteNarrativeTemplate(
          request.narrativeTemplateId
        )
    )

    handlers.registerPostNarrativeTemplate(
      async (ctx, request) =>
        await narrativeService.createNarrativeTemplate(
          request.NarrativeTemplateRequest
        )
    )

    return await handlers.handle(event)
  }
)
