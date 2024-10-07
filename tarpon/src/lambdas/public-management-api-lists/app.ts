import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ListService } from '@/services/list'

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

    return handlers.handle(event)
  }
)
