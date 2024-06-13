import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import createHttpError from 'http-errors'
import { isEmpty } from 'lodash'
import { CaseConfig } from '../console-api-case/app'
import { AlertCreationRequest } from '@/@types/openapi-public-management/AlertCreationRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ExternalAlertManagementService } from '@/services/alerts/external-alerts-management-service'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AlertStatusChangeRequest } from '@/@types/openapi-public-management/AlertStatusChangeRequest'
import { getS3ClientByEvent } from '@/utils/s3'
import { getCredentialsFromEvent } from '@/utils/credentials'

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

    if (event.httpMethod === 'POST' && event.resource === '/alerts') {
      const payload = JSON.parse(event.body || '{}') as AlertCreationRequest

      if (!payload || isEmpty(payload)) {
        throw new createHttpError.BadRequest(
          'Payload seems to be empty or missing. Please provide a valid payload'
        )
      }

      return await service.createAlert(payload)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/alerts/{alertId}' &&
      event.pathParameters?.alertId
    ) {
      const alertId = event.pathParameters.alertId
      return await service.getAlert(alertId)
    } else if (
      event.httpMethod === 'PATCH' &&
      event.resource === '/alerts/{alertId}' &&
      event.pathParameters?.alertId
    ) {
      const alertId = event.pathParameters.alertId
      const payload = JSON.parse(event.body || '{}') as AlertCreationRequest

      if (!payload || isEmpty(payload)) {
        throw new createHttpError.BadRequest(
          'Payload seems to be empty or missing. Please provide a valid payload'
        )
      }

      return await service.updateAlert(alertId, payload)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/alerts/{alertId}/statuses' &&
      event.pathParameters?.alertId
    ) {
      const alertId = event.pathParameters.alertId
      const payload = JSON.parse(event.body || '{}') as AlertStatusChangeRequest
      return await service.updateAlertStatus(payload, alertId)
    }

    throw new createHttpError.NotFound('Resource not found')
  }
)
