import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  ChecklistTemplateWithId,
  ChecklistTemplatesService,
} from '@/services/checklist-templates'

export const checklistTemplateHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const service = new ChecklistTemplatesService(
      tenantId,
      await getMongoDbClient()
    )
    const handlers = new Handlers()

    handlers.registerGetChecklistTemplate(async (ctx, request) => {
      return service.getChecklistTemplate(request.checklistTemplateId)
    })
    handlers.registerGetChecklistTemplates(async (ctx, request) => {
      return service.getChecklistTemplates(request)
    })
    handlers.registerPostChecklistTemplates(async (ctx, request) => {
      return service.createChecklistTemplate(request.ChecklistTemplate)
    })
    handlers.registerPutChecklistTemplates(async (ctx, request) => {
      return service.updateChecklistTemplate({
        ...request.ChecklistTemplate,
        id: request.checklistTemplateId,
      } as ChecklistTemplateWithId)
    })
    handlers.registerDeleteChecklistTemplate(async (ctx, request) => {
      await service.deleteChecklistTemplate(request.checklistTemplateId)
    })

    return await handlers.handle(event)
  }
)
