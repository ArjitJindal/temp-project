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
import { PresignedUrlResponse } from '../../@types/openapi-internal/presignedUrlResponse'
import { compose } from '../../core/middlewares/compose'
import { ImportResponse } from '../../@types/openapi-internal/importResponse'
import { ImportRequest } from '../../@types/openapi-internal/importRequest'
import { JWTAuthorizerResult } from '../jwt-authorizer/app'
import { Importer } from './importer'

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
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ): Promise<ImportResponse> => {
    const { IMPORT_TMP_BUCKET, IMPORT_BUCKET } = process.env as FileImportConfig
    const { principalId: tenantId, tenantName } =
      event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const s3 = getS3Client(event)

    if (event.httpMethod === 'POST' && event.body) {
      const importRequest: ImportRequest = JSON.parse(event.body)
      const importer = new Importer(
        tenantId,
        tenantName,
        dynamoDb,
        s3,
        IMPORT_TMP_BUCKET,
        IMPORT_BUCKET
      )
      if (importRequest.type === ImportRequest.TypeEnum.Transaction) {
        return {
          importedCount: await importer.importTransactions(importRequest),
        }
      } else if (importRequest.type === ImportRequest.TypeEnum.User) {
        return {
          importedCount: await importer.importConsumerUsers(importRequest),
        }
      } else if (importRequest.type === ImportRequest.TypeEnum.Business) {
        return {
          importedCount: await importer.importBusinessUsers(importRequest),
        }
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
