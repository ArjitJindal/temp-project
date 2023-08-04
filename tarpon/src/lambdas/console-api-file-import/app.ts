import { v4 as uuidv4 } from 'uuid'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { ImportRepository } from './import-repository'
import { getS3ClientByEvent } from '@/utils/s3'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
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

    const handlers = new Handlers()

    handlers.registerPostImport(
      async (ctx, request) =>
        await importRepository.postFileImport(
          request.ImportRequest,
          tenantName,
          getCredentialsFromEvent(event)
        )
    )

    handlers.registerGetImportImportId(
      async (ctx, request) =>
        await importRepository.getFileImport(request.importId)
    )

    return await handlers.handle(event)
  }
)

export type GetPresignedUrlConfig = {
  TMP_BUCKET: string
}

export const getPresignedUrlHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { TMP_BUCKET } = process.env as GetPresignedUrlConfig
    const s3 = getS3ClientByEvent(event)

    const handlers = new Handlers()

    handlers.registerPostGetPresignedUrl(async (ctx) => {
      const s3Key = `${ctx.tenantId}/${uuidv4()}`
      const getObjectCommand = new GetObjectCommand({
        Bucket: TMP_BUCKET,
        Key: s3Key,
      })

      const url = await getSignedUrl(s3, getObjectCommand, {
        expiresIn: 3600,
      })

      return {
        presignedUrl: url,
        s3Key,
      }
    })

    return await handlers.handle(event)
  }
)
