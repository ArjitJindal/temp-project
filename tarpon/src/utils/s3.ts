import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { getCredentialsFromEvent } from './credentials'

export function getS3Client(credentials?: LambdaCredentials): S3 {
  return new S3({ credentials })
}

export function getS3ClientByEvent(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<Credentials>
  >
): S3 {
  return getS3Client(getCredentialsFromEvent(event))
}

export async function readFileFromS3(
  s3Client: S3,
  bucketName: string,
  key: string
): Promise<string> {
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
    const { Body } = await s3Client.send(command)

    if (Body) {
      return await Body.transformToString()
    } else {
      throw new Error('No content found in S3 object.')
    }
  } catch (error) {
    console.error('Error reading file from S3:', error)
    throw error
  }
}

export async function getStreamFromS3(
  bucketName: string,
  key: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const s3Client = getS3Client()
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
  const { Body } = await s3Client.send(command)
  const stream = Body?.transformToWebStream()
  if (!stream) {
    throw new Error('Stream is undefined')
  }

  const reader = stream.getReader()
  return reader
}
