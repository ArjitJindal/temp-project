import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as createError from 'http-errors'
import { getDynamoDbClient } from '../utils/dynamodb'
import { getS3Client } from '../utils/s3'
import { httpErrorHandler } from '../core/middlewares/http-error-handler'
import { jsonSerializer } from '../core/middlewares/json-serializer'
import { TransactionImporter } from './transaction/importer'

const internalFileImportHandler = async (
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
  >
) => {
  const { tenantId } = event.queryStringParameters as any
  const dynamoDb = getDynamoDbClient(event)
  const s3 = getS3Client(event)

  if (event.httpMethod === 'POST' && event.body) {
    const importRequest = JSON.parse(event.body)
    if (importRequest.type === 'TRANSACTION') {
      const transactionImporter = new TransactionImporter(
        tenantId,
        dynamoDb,
        s3
      )
      const importedTransactions = await transactionImporter.importTransactions(
        importRequest
      )
      return { importedTransactions }
    }
  }

  throw new createError.NotImplemented()
}

export const fileImportHandler = httpErrorHandler()(
  jsonSerializer()(internalFileImportHandler)
)
