import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { ListRepository } from '../../services/list/repositories/list-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { ListData } from '@/@types/openapi-internal/ListData'
import { NewListPayload } from '@/@types/openapi-internal/NewListPayload'
import { ListExisted } from '@/@types/openapi-internal/ListExisted'
import { ListItem } from '@/@types/openapi-internal/ListItem'

export const listsHandler = lambdaApi({
  requiredFeatures: ['LISTS'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const listRepository = new ListRepository(tenantId, dynamoDb)

    if (event.resource === '/lists') {
      if (event.httpMethod === 'GET') {
        const { listType } = event.queryStringParameters as any
        return await listRepository.getListHeaders(listType)
      } else if (event.httpMethod === 'POST') {
        if (!event.body) {
          throw new BadRequest('Empty body')
        }
        let body: NewListPayload
        try {
          body = JSON.parse(event.body)
        } catch (e) {
          throw new BadRequest('Invalid Request')
        }
        const newList: ListExisted = await listRepository.createList(
          body.listType,
          body.subtype,
          body.data
        )
        return newList
      }
    } else if (event.resource === '/lists/{listId}') {
      const { listId } = event.pathParameters as any
      if (event.httpMethod === 'GET') {
        const list = await listRepository.getListHeader(listId)
        if (list == null) {
          throw new NotFound(`List with id "${listId}" not found`)
        }
        return list
      } else if (event.httpMethod === 'DELETE') {
        await listRepository.deleteList(listId)
        return null
      } else if (event.httpMethod === 'PATCH') {
        if (!event.body) {
          throw new BadRequest('Empty body')
        }
        let body: ListData
        try {
          body = JSON.parse(event.body)
        } catch (e) {
          throw new BadRequest('Unable to parse list from request body')
        }
        const list = await listRepository.getListHeader(listId)
        if (list == null) {
          throw new NotFound(`List with id "${listId}" not found`)
        }
        if (body.metadata != null) {
          await listRepository.updateListHeader({
            ...list,
            metadata: body.metadata,
          })
        }
        if (body.items) {
          await listRepository.updateListItems(listId, body.items)
        }
        return null
      }
    } else if (event.resource === '/lists/{listId}/items') {
      const { listId } = event.pathParameters as any
      if (event.httpMethod === 'GET') {
        const { page = 1 } = (event.queryStringParameters as any) ?? {}
        let response: any = undefined
        for (let i = 0; i < page; i += 1) {
          response = await listRepository.getListItems(listId, {
            cursor: response?.cursor,
          })
          if (response == null) {
            break
          }
        }
        return response?.items
      } else if (event.httpMethod === 'POST') {
        if (!event.body) {
          throw new BadRequest('Empty body')
        }
        let body: ListItem
        try {
          body = JSON.parse(event.body)
        } catch (e) {
          throw new BadRequest('Unable to parse list from request body')
        }
        await listRepository.setListItem(listId, body)
        return null
      }
    } else if (event.resource === '/lists/{listId}/items/{key}') {
      const { listId, key } = event.pathParameters as any
      if (event.httpMethod === 'DELETE') {
        await listRepository.deleteListItem(listId, key)
        return null
      }
    }
    throw new BadRequest('Unhandled request')
  }
)
