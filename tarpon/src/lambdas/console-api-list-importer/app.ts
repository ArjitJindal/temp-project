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
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'

export const listsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const s3 = getS3ClientByEvent(event)
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig

    const listService = new ListService(tenantId, { dynamoDb }, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })

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

    handlers.registerClearListItems(async (ctx, request) => {
      await listService.clearListItems(request.listId)
      return null
    })

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
      const { listId, start, pageSize } = request
      return await listService.getListItems(listId, {
        fromCursorKey: start,
        pageSize,
      })
    })

    handlers.registerPostListItem(
      async (ctx, request) =>
        await listService.setListItem(request.listId, request.ListItem)
    )

    handlers.registerDeleteListItem(
      async (ctx, request) =>
        await listService.deleteListItem(request.listId, request.key)
    )

    handlers.registerListImportCsv(async (ctx, request) => {
      return await listService.importFromCSV(
        request.listId,
        request.InlineObject.file
      )
    })

    return await handlers.handle(event)
  }
)
