import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { ImportRepository } from './import-repository'
import { getS3ClientByEvent } from '@/utils/s3'
import { PresignedUrlResponse } from '@/@types/openapi-internal/PresignedUrlResponse'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getCredentialsFromEvent } from '@/utils/credentials'

export type FileImportConfig = {
  IMPORT_BUCKET: string
  TMP_BUCKET: string
}

export const fileImportHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, tenantName } =
      event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const importRepository = new ImportRepository(tenantId, {
      mongoDb,
    })

    if (event.httpMethod === 'POST' && event.body) {
      const importRequest: ImportRequest = JSON.parse(event.body)
      await importRepository.postFileImport(
        importRequest,
        tenantName,
        getCredentialsFromEvent(event)
      )
      return
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
    const s3 = getS3ClientByEvent(event)

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
