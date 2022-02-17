import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { getDynamoDbClient } from '../utils/dynamodb'
import { getS3Client } from '../utils/s3'
import { httpErrorHandler } from '../core/middlewares/http-error-handler'
import { jsonSerializer } from '../core/middlewares/json-serializer'
import { getS3BucketName, TarponStackConstants } from '../../lib/constants'
import {
  TransactionImporter,
  TransactionImportRequest,
} from './transaction/importer'

const internalFileImportHandler = async (
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
) => {
  const { tenantId } = event.queryStringParameters as any
  const dynamoDb = getDynamoDbClient(event)
  const s3 = getS3Client(event)

  if (event.httpMethod === 'POST' && event.body) {
    const importRequest: TransactionImportRequest = JSON.parse(event.body)
    if (importRequest.type === 'TRANSACTION') {
      const transactionImporter = new TransactionImporter(
        tenantId,
        dynamoDb,
        s3,
        event.requestContext?.accountId
      )
      const importedTransactions = await transactionImporter.importTransactions(
        importRequest
      )
      return { importedTransactions }
    }
  }

  throw new createError.NotImplemented()
}

const internalGetPresignedUrlHandler = async (
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
) => {
  const { accountId } = event.requestContext
  const { tenantId } = event.queryStringParameters as any
  const s3 = getS3Client(event)

  const s3Key = `${tenantId}/${uuidv4()}`
  const bucketParams = {
    Bucket: getS3BucketName(
      TarponStackConstants.S3_IMPORT_TMP_BUCKET_PREFIX,
      accountId
    ),
    Key: s3Key,
    Expires: 3600,
  }
  const presignedUrl = s3.getSignedUrl('putObject', bucketParams)

  return { presignedUrl, key: s3Key }
}

export const fileImportHandler = httpErrorHandler()(
  jsonSerializer()(internalFileImportHandler)
)
export const getPresignedUrlHandler = httpErrorHandler()(
  jsonSerializer()(internalGetPresignedUrlHandler)
)
