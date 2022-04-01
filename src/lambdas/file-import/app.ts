import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { Importer } from './importer'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3Client } from '@/utils/s3'
import { PresignedUrlResponse } from '@/@types/openapi-internal/PresignedUrlResponse'
import { ImportResponse } from '@/@types/openapi-internal/ImportResponse'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'

export type FileImportConfig = {
  IMPORT_BUCKET: string
  TMP_BUCKET: string
}

export const fileImportHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ): Promise<ImportResponse> => {
    const { TMP_BUCKET, IMPORT_BUCKET } = process.env as FileImportConfig
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
        TMP_BUCKET,
        IMPORT_BUCKET
      )
      if (importRequest.type === 'TRANSACTION') {
        return {
          importedCount: await importer.importTransactions(importRequest),
        }
      } else if (importRequest.type === 'USER') {
        return {
          importedCount: await importer.importConsumerUsers(importRequest),
        }
      } else if (importRequest.type === 'BUSINESS') {
        return {
          importedCount: await importer.importBusinessUsers(importRequest),
        }
      }
    }

    throw new createError.NotImplemented()
  }
)

export type GetPresignedUrlConfig = {
  TMP_BUCKET: string
}

export const getPresignedUrlHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<PresignedUrlResponse> => {
    const { TMP_BUCKET } = process.env as GetPresignedUrlConfig
    const { principalId: tenantId } = event.requestContext.authorizer
    const s3 = getS3Client(event)

    const s3Key = `${tenantId}/${uuidv4()}`
    const bucketParams = {
      Bucket: TMP_BUCKET,
      Key: s3Key,
      Expires: 3600,
    }
    const presignedUrl = s3.getSignedUrl('putObject', bucketParams)

    return { presignedUrl, s3Key }
  }
)
