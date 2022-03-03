import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { getS3Client } from '../../utils/s3'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'
import { TransactionImportRequest } from '../../@types/openapi-internal/transactionImportRequest'
import { PresignedUrlResponse } from '../../@types/openapi-internal/presignedUrlResponse'
import { TransactionImportResponse } from '../../@types/openapi-internal/transactionImportResponse'
import { compose } from '../../core/middlewares/compose'
import { TransactionImporter } from './transaction/importer'

export type FileImportConfig = {
  IMPORT_BUCKET: string
  IMPORT_TMP_BUCKET: string
}

export const fileImportHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<TransactionImportResponse> => {
    const { IMPORT_TMP_BUCKET, IMPORT_BUCKET } = process.env as FileImportConfig
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const s3 = getS3Client(event)

    if (event.httpMethod === 'POST' && event.body) {
      const importRequest: TransactionImportRequest = JSON.parse(event.body)
      if (
        importRequest.type === TransactionImportRequest.TypeEnum.Transaction
      ) {
        const transactionImporter = new TransactionImporter(
          tenantId,
          dynamoDb,
          s3,
          IMPORT_TMP_BUCKET,
          IMPORT_BUCKET
        )
        const importedTransactions =
          await transactionImporter.importTransactions(importRequest)
        return { importedTransactions }
      }
    }

    throw new createError.NotImplemented()
  }
)

export type GetPresignedUrlConfig = {
  IMPORT_TMP_BUCKET: string
}

export const getPresignedUrlHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<PresignedUrlResponse> => {
    const { IMPORT_TMP_BUCKET } = process.env as GetPresignedUrlConfig
    const { principalId: tenantId } = event.requestContext.authorizer
    const s3 = getS3Client(event)

    const s3Key = `${tenantId}/${uuidv4()}`
    const bucketParams = {
      Bucket: IMPORT_TMP_BUCKET,
      Key: s3Key,
      Expires: 3600,
    }
    const presignedUrl = s3.getSignedUrl('putObject', bucketParams)

    return { presignedUrl, s3Key }
  }
)
