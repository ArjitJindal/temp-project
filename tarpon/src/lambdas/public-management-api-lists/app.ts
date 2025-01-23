import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { InternalServerError, NotFound } from 'http-errors'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ListService } from '@/services/list'
import { ListsResponse } from '@/@types/openapi-public-management/ListsResponse'
import { ListItemsResponse } from '@/@types/openapi-public-management/ListItemsResponse'

export const listsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()

    const listService = await ListService.fromEvent(event)

    handlers.registerPostLists(async (ctx, request) => {
      const { operation, listId } = request.ListUpdateRequest

      if (operation === 'CLEAR') {
        await listService.clearListItems(listId)

        return {
          listId,
          message: 'List cleared successfully',
          status: 'SUCCESS',
        }
      } else {
        // Append
        const { listType, subtype, data } = request.ListUpdateRequest
        if (!(await listService.getListHeader(listId))) {
          await listService.createList(listType, subtype, data, listId)
        } else {
          await listService.setListItems(listId, data.items)
        }

        return {
          listId,
          message: 'List updated successfully',
          status: 'SUCCESS',
        }
      }
    })

    handlers.registerGetLists(async (_ctx, _request) => {
      const listHeaders = await listService.getListHeaders()
      return {
        lists: listHeaders,
      } as ListsResponse
    })

    handlers.registerGetListById(async (_ctx, request) => {
      try {
        const listItems = await listService.getListItems(request.listId, {
          fromCursorKey: request.start,
          pageSize: request.pageSize,
        })
        return {
          listId: request.listId,
          start: request.start,
          pageSize: request.pageSize,
          items: listItems.items,
        } as ListItemsResponse
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes(`List doesn't exist`)
        ) {
          throw new NotFound('List not found')
        }
        throw new InternalServerError('Error getting list items')
      }
    })

    return handlers.handle(event)
  }
)
