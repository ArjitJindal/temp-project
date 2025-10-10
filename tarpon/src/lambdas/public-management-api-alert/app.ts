import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { CaseConfig } from '@/@types/cases/case-config'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ExternalAlertManagementService } from '@/services/alerts/external-alerts-management-service'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3ClientByEvent } from '@/utils/s3'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'

export const alertHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const tenantId = event.requestContext.authorizer?.principalId as string

    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const s3 = getS3ClientByEvent(event)
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const service = new ExternalAlertManagementService(
      tenantId,
      { mongoDb, dynamoDb },
      s3,
      { documentBucketName: DOCUMENT_BUCKET, tmpBucketName: TMP_BUCKET },
      getCredentialsFromEvent(event)
    )
    const handlers = new Handlers()

    handlers.registerPostAlerts(async (ctx, request) => {
      const payload = request.AlertCreationRequest
      const response = await service.createAlert(payload)
      return response.result
    })

    handlers.registerGetAlertsAlertId(async (ctx, request) => {
      const alertId = request.alertId
      return await service.getAlert(alertId)
    })

    handlers.registerPatchAlertsAlertId(async (ctx, request) => {
      const alertId = request.alertId
      const payload = request.AlertUpdatable
      const response = await service.updateAlert(alertId, payload)
      return response.result
    })

    handlers.registerPostAlertComment(async (ctx, request) => {
      const alertId = request.alertId
      const payload = request.CommentRequest
      return await service.saveAlertComment(alertId, payload)
    })

    handlers.registerGetAlertComments(async (ctx, request) => {
      const alertId = request.alertId
      return await service.getComments(alertId)
    })

    handlers.registerGetAlertComment(async (ctx, request) => {
      const alertId = request.alertId
      const commentId = request.commentId
      return await service.getComment(alertId, commentId)
    })

    handlers.registerDeleteAlertComment(async (ctx, request) => {
      const alertId = request.alertId
      const commentId = request.commentId
      return await service.deleteAlertComment(alertId, commentId)
    })

    handlers.registerPostAlertsAlertIdStatuses(async (ctx, request) => {
      const alertId = request.alertId
      const payload = request.AlertStatusChangeRequest
      return await service.updateAlertStatus(payload, alertId)
    })

    return handlers.handle(event)
  }
)
