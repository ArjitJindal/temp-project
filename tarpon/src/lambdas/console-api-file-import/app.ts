import { v4 as uuidv4 } from 'uuid'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { getS3ClientByEvent } from '@/utils/s3'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

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
