import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { CaseConfig } from '../console-api-case/app'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ExternalCaseManagementService } from '@/services/cases/external-case-management-service'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3ClientByEvent } from '@/utils/s3'
import { DefaultApiGetCasesRequest } from '@/@types/openapi-public-management/RequestParameters'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'

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
      { mongoDb, dynamoDb },
      s3,
      { documentBucketName: DOCUMENT_BUCKET, tmpBucketName: TMP_BUCKET },
      getCredentialsFromEvent(event)
    )

    const handlers = new Handlers()

    handlers.registerPostCases(async (ctx, request) => {
      const payload = request.CaseCreationRequest
      const response = await caseService.createCase(payload)
      return response.result
    })

    handlers.registerGetCasesCaseId(async (ctx, request) => {
      const caseId = request.caseId
      return await caseService.getCaseById(caseId)
    })

    handlers.registerPatchCasesCaseId(async (ctx, request) => {
      const caseId = request.caseId
      const payload = request.CaseUpdateable
      const response = await caseService.updateCase(caseId, payload)
      return response.result
    })

    handlers.registerPostCasesCaseIdStatuses(async (ctx, request) => {
      const caseId = request.caseId
      const payload = request.CaseStatusChangeRequest
      return await caseService.updateCaseStatus(payload, caseId)
    })

    handlers.registerGetCases(async (ctx, request) => {
      const query: DefaultApiGetCasesRequest =
        caseService.validateAndTransformGetCasesRequest(request)
      return await caseService.getCases(query)
    })

    return handlers.handle(event)
  }
)
