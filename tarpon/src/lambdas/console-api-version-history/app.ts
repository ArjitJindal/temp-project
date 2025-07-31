import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { VersionHistoryType } from '@/@types/openapi-internal/VersionHistoryType'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { VersionHistoryService } from '@/services/version-history'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const versionHistoryHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const versionHistoryService = new VersionHistoryService(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const handlers = new Handlers()

    handlers.registerGetVersionHistory(async (ctx, request) => {
      return await versionHistoryService.getRiskClassificationHistory(request)
    })

    handlers.registerGetVersionHistoryByVersionId(async (ctx, request) => {
      return await versionHistoryService.getVersionHistoryById(
        request.versionId
      )
    })

    handlers.registerGetNewVersionId(async (ctx, request) => {
      return {
        id: await versionHistoryService.getNewVersionId(
          request.type as VersionHistoryType
        ),
      }
    })

    handlers.registerRestoreVersionHistory(async (ctx, request) => {
      return await versionHistoryService.restoreVersionHistory(
        request.VersionHistoryRestorePayload
      )
    })

    return await handlers.handle(event)
  }
)
