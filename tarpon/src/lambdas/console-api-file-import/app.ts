import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { isEmpty } from 'lodash'
import { BadRequest } from 'http-errors'
import { hasFeature } from '@/core/utils/context'
import { getS3ClientByEvent } from '@/utils/s3'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import {
  ACCEPTED_FILE_EXTENSIONS_SET,
  MAX_FILE_SIZE_BYTES,
} from '@/core/constants'

function getAcceptedFileExtensions() {
  if (hasFeature('STRICT_FILE_SECURITY')) {
    return new Set(
      Array.from(ACCEPTED_FILE_EXTENSIONS_SET).filter(
        (ext) => !ext.startsWith('.xl')
      )
    )
  }
  return ACCEPTED_FILE_EXTENSIONS_SET
}

export type GetPresignedUrlConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const getPresignedUrlHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { TMP_BUCKET, DOCUMENT_BUCKET } = process.env as GetPresignedUrlConfig

    const s3 = getS3ClientByEvent(event)

    const handlers = new Handlers()

    handlers.registerGetPresignedDownloadUrl(async (ctx, request) => {
      const { bucket, key } = request
      let bucketFullName
      if (bucket === 'document') {
        bucketFullName = DOCUMENT_BUCKET
      } else if (bucket === 'tmp') {
        bucketFullName = TMP_BUCKET
      } else {
        throw new Error(`Bucket not supported yet: ${bucket}`)
      }
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketFullName,
        Key: key,
      })

      const url = await getSignedUrl(s3, getObjectCommand, {
        expiresIn: 3600,
      })

      return { url }
    })

    handlers.registerPostGetPresignedUrl(async (ctx, request) => {
      if (isEmpty(request.filename)) {
        throw new BadRequest('Filename is required')
      }

      // Accept only specific file extensions
      const fileExtension = extname(request.filename)
      const acceptedFileExtensions = getAcceptedFileExtensions()
      if (!acceptedFileExtensions.has(fileExtension.toLowerCase())) {
        throw new BadRequest(
          `File extension "${fileExtension}" is not allowed. Allowed extensions are: ${Array.from(
            acceptedFileExtensions
          ).join(', ')}`
        )
      }

      if (request.fileSize > MAX_FILE_SIZE_BYTES) {
        throw new BadRequest(
          `File size is too large. Maximum allowed file size is ${
            MAX_FILE_SIZE_BYTES / 10 ** 6
          } MB`
        )
      }

      const s3Key = `${ctx.tenantId}/${uuidv4()}`
      const putObjectCommand = new PutObjectCommand({
        Bucket: TMP_BUCKET,
        Key: s3Key,
      })

      const url = await getSignedUrl(s3, putObjectCommand, {
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
