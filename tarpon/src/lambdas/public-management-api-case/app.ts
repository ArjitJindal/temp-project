import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import createHttpError from 'http-errors'
import { isEmpty } from 'lodash'
import { CaseConfig } from '../console-api-case/app'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ExternalCaseManagementService } from '@/services/cases/external-case-management-service'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseStatusChangeRequest } from '@/@types/openapi-public-management/CaseStatusChangeRequest'
import { DefaultApiGetCasesRequest } from '@/@types/openapi-public-management/RequestParameters'

export const caseHandler = lambdaApi()(
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
    const caseService = new ExternalCaseManagementService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      {
        documentBucketName: DOCUMENT_BUCKET,
        tmpBucketName: TMP_BUCKET,
      }
    )

    if (event.httpMethod === 'POST' && event.resource === '/cases') {
      const payload = JSON.parse(event.body || '{}') as CaseCreationRequest

      if (!payload || isEmpty(payload)) {
        throw new createHttpError.BadRequest(
          'Payload seems to be empty or missing. Please provide a valid payload'
        )
      }

      return await caseService.createCase(payload)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/cases/{caseId}' &&
      event.pathParameters?.caseId
    ) {
      const caseId = event.pathParameters.caseId
      return await caseService.getCaseById(caseId)
    } else if (
      event.resource === '/cases/{caseId}' &&
      event.httpMethod === 'PATCH' &&
      event.pathParameters?.caseId
    ) {
      const caseId = event.pathParameters.caseId

      const payload = JSON.parse(
        event.body || '{}'
      ) as Partial<CaseCreationRequest>

      if (!payload || isEmpty(payload)) {
        throw new createHttpError.BadRequest(
          'Payload seems to be empty or missing. Please provide a valid payload'
        )
      }

      return await caseService.updateCase(caseId, payload)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases/{caseId}/statuses' &&
      event.pathParameters?.caseId
    ) {
      const caseId = event.pathParameters.caseId
      const payload = JSON.parse(event.body || '{}') as CaseStatusChangeRequest

      if (!payload || isEmpty(payload)) {
        throw new createHttpError.BadRequest(
          'Payload seems to be empty or missing. Please provide a valid payload'
        )
      }

      return await caseService.updateCaseStatus(payload, caseId)
    } else if (event.httpMethod === 'GET' && event.resource === '/cases') {
      const query: DefaultApiGetCasesRequest =
        caseService.validateAndTransformGetCasesRequest(
          event.queryStringParameters || {}
        )

      return await caseService.getCases(query)
    }

    throw new createHttpError.NotFound('Resource not found')
  }
)
