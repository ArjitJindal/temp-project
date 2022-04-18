import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { Importer } from './importer'
import { ImportRepository } from './import-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3Client } from '@/utils/s3'
import { PresignedUrlResponse } from '@/@types/openapi-internal/PresignedUrlResponse'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { connectToDB } from '@/utils/docDBUtils'

export type FileImportConfig = {
  IMPORT_BUCKET: string
  TMP_BUCKET: string
}

// TODO: Move to phytoplankton-internal-api-handlers
export const fileImportHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { TMP_BUCKET, IMPORT_BUCKET } = process.env as FileImportConfig
    const { principalId: tenantId, tenantName } =
      event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const s3 = getS3Client(event)
    const importRepository = new ImportRepository(tenantId, {
      mongoDb: await connectToDB(),
    })

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
      let importedCount = 0
      const importId = importRequest.s3Key.replace(/\//g, '')
      await importRepository.createFileImport({
        _id: importId,
        type: importRequest.type,
        s3Key: importRequest.s3Key,
        filename: importRequest.filename,
        statuses: [{ status: 'IN_PROGRESS', timestamp: Date.now() }],
      })
      try {
        if (importRequest.type === 'TRANSACTION') {
          importedCount = await importer.importTransactions(importRequest)
        } else if (importRequest.type === 'USER') {
          importedCount = await importer.importConsumerUsers(importRequest)
        } else if (importRequest.type === 'BUSINESS') {
          importedCount = await importer.importBusinessUsers(importRequest)
        }
        await importRepository.completeFileImport(importId, importedCount)
        return 'OK'
      } catch (e) {
        await importRepository.failFileImport(
          importId,
          e instanceof Error ? e.message : 'Unknown'
        )
        throw e
      }
    } else if (event.httpMethod === 'GET' && event.pathParameters?.importId) {
      return importRepository.getFileImport(event.pathParameters.importId)
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
