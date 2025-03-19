import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { GetPresignedUrlConfig } from '../console-api-file-import/app'
import { getS3ClientByEvent } from '@/utils/s3'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'

export const fileUploadHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const tenantId = event.requestContext.authorizer?.principalId as string
    const s3 = getS3ClientByEvent(event)
    const { TMP_BUCKET } = process.env as GetPresignedUrlConfig
    if (!TMP_BUCKET) {
      throw new Error(
        'TMP_BUCKET not configured. Please configure TMP_BUCKET in environment variables'
      )
    }
    const handlers = new Handlers()
    handlers.registerGetUploadPresignedUrl(async (ctx, request) => {
      const payload = request.PresignedPostRequest

      const s3Key = `${tenantId}/${uuidv4()}`

      const presignedPost = await createPresignedPost(s3, {
        Bucket: TMP_BUCKET,
        Key: s3Key,
        Fields: {
          key: s3Key,
          name: payload.filename,
        },
        Conditions: [
          ['eq', '$key', s3Key],
          ['content-length-range', payload.fileSize, payload.fileSize], // 100MB limit for file size synced with file size limit in the openapi schema
          ['eq', '$name', payload.filename],
        ],
        Expires: 9000,
      })

      const fields = presignedPost.fields

      return {
        url: presignedPost.url,
        fields: {
          key: fields.key,
          name: fields.name,
          policy: fields.policy,
          x_amz_algorithm: fields.x_amz_algorithm,
          x_amz_credential: fields.x_amz_credential,
          x_amz_date: fields.x_amz_date,
          x_amz_signature: fields.x_amz_signature,
        },
      }
    })

    return handlers.handle(event)
  }
)
