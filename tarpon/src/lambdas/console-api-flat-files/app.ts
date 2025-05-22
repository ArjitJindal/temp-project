import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { FlatFilesService } from '@/services/flat-files'

export const flatFilesHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const handlers = new Handlers()

    handlers.registerPostFlatFilesGenerateTemplate(async (ctx, request) => {
      const { schema, format } = request.FlatFileTemplateRequest
      const flatFilesService = new FlatFilesService(ctx.tenantId)
      const template = await flatFilesService.generateTemplate(schema, format)
      return template
    })

    return handlers.handle(event)
  }
)
