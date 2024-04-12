import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ListType } from '@/@types/openapi-internal/ListType'
import { ListService } from '@/services/list'

export const listsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const listService = new ListService(tenantId, { dynamoDb })

    const handlers = new Handlers()

    handlers.registerGetLists(
      async (ctx, request) =>
        await listService.getListHeaders(
          (request.listType as ListType | null) ?? null
        )
    )

    handlers.registerPostList(
      async (ctx, request) =>
        await listService.createList(
          request.NewListPayload.listType,
          request.NewListPayload.subtype,
          request.NewListPayload.data
        )
    )

    handlers.registerGetList(
      async (ctx, request) => await listService.getListHeader(request.listId)
    )

    handlers.registerDeleteList(
      async (ctx, request) => await listService.deleteList(request.listId)
    )

    handlers.registerPatchList(async (ctx, request) => {
      const listId = request.listId
      const body = request.ListData
      const list = await listService.getListHeader(listId)
      if (list == null) {
        return null
      }
      if (body.metadata != null) {
        await listService.updateListHeader({
          ...list,
          metadata: body.metadata,
        })
      }
      if (body.items) {
        await listService.updateListItems(listId, body.items)
      }
      return { listId, header: list, items: body.items ?? [] }
    })

    handlers.registerGetListItems(async (ctx, request) => {
      const { listId, page = 1 } = request
      let response: any = undefined
      for (let i = 0; i < page; i += 1) {
        response = await listService.getListItems(listId, {
          cursor: response?.cursor,
        })
        if (response == null) {
          break
        }
      }
      return response?.items ?? []
    })

    handlers.registerPostListItem(
      async (ctx, request) =>
        await listService.setListItem(request.listId, request.ListItem)
    )

    handlers.registerDeleteListItem(
      async (ctx, request) =>
        await listService.deleteListItem(request.listId, request.key)
    )

    return await handlers.handle(event)
  }
)
