import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import httpsErrors from 'http-errors'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ListService } from '@/services/list'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { DefaultApiPatchBlacklistRequest } from '@/@types/openapi-internal/RequestParameters'

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

    handlers.registerGetWhitelist(
      async () => await listService.getListHeaders('WHITELIST')
    )

    handlers.registerGetBlacklist(
      async () => await listService.getListHeaders('BLACKLIST')
    )

    handlers.registerPostWhiteList(
      async (ctx, request) =>
        await listService.createList(
          'WHITELIST',
          request.NewListPayload.subtype,
          request.NewListPayload.data
        )
    )

    handlers.registerPostBlacklist(
      async (ctx, request) =>
        await listService.createList(
          'BLACKLIST',
          request.NewListPayload.subtype,
          request.NewListPayload.data
        )
    )

    handlers.registerGetWhitelistListHeader(async (ctx, request) => {
      const list = await listService.getListHeader(request.listId)

      if (list == null) {
        throw new httpsErrors.NotFound(
          `White list not found: ${request.listId}`
        )
      }
      return list
    })

    handlers.registerGetBlacklistListHeader(async (ctx, request) => {
      const list = await listService.getListHeader(request.listId)
      if (list == null) {
        throw new httpsErrors.NotFound(
          `Black list not found: ${request.listId}`
        )
      }
      return list
    })

    handlers.registerDeleteWhiteList(
      async (ctx, request) => await listService.deleteList(request.listId)
    )

    handlers.registerDeleteBlacklist(
      async (ctx, request) => await listService.deleteList(request.listId)
    )

    handlers.registerClearWhiteListItems(async (ctx, request) => {
      await listService.clearListItems(request.listId)
      return null
    })

    const patchList = async (request: DefaultApiPatchBlacklistRequest) => {
      const listId = request.listId
      const body = request.ListData
      const list = await listService.getListHeader(listId)
      if (list == null) {
        throw new httpsErrors.NotFound(`List not found: ${listId}`)
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
    }

    handlers.registerPatchWhiteList(async (ctx, request) => patchList(request))
    handlers.registerPatchBlacklist(async (ctx, request) => patchList(request))

    handlers.registerGetWhiteListItems(async (ctx, request) => {
      const { listId, start, pageSize } = request
      return await listService.getListItems(listId, {
        fromCursorKey: start,
        pageSize,
      })
    })

    handlers.registerGetBlacklistItems(async (ctx, request) => {
      const { listId, start, pageSize } = request
      return await listService.getListItems(listId, {
        fromCursorKey: start,
        pageSize,
      })
    })

    handlers.registerPostWhiteListItem(
      async (ctx, request) =>
        await listService.setListItem(request.listId, request.ListItem)
    )

    handlers.registerPostBlacklistItem(
      async (ctx, request) =>
        await listService.setListItem(request.listId, request.ListItem)
    )

    handlers.registerDeleteWhiteListItem(
      async (ctx, request) =>
        await listService.deleteListItem(request.listId, request.key)
    )

    handlers.registerDeleteBlacklistItem(
      async (ctx, request) =>
        await listService.deleteListItem(request.listId, request.key)
    )

    handlers.registerWhiteListImportCsv(async (ctx, request) => {
      return await listService.importFromCSV(
        request.listId,
        request.InlineObject.file
      )
    })

    return await handlers.handle(event)
  }
)
