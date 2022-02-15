import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { getDynamoDbClient } from '../utils/dynamodb'
import { getS3Client } from '../utils/s3'
import { TransactionImporter } from './transaction/importer'

export const fileImportHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
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
      return {
        statusCode: 200,
        body: JSON.stringify({ importedTransactions }),
      }
    }
  }

  return {
    statusCode: 500,
    body: 'Unhandled request',
  }
}
