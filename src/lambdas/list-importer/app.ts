import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { parse } from '@fast-csv/parse'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { lambdaApi } from '../../core/middlewares/lambda-api-middlewares'
import { ListRepository } from './repositories/list-repository'

export const listImporterHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    if (!event.body) {
      return 'Request payload is missing'
    }

    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const listRepository = new ListRepository(tenantId, dynamoDb)

    const { listName, indexName, data } = JSON.parse(event.body)
    const rows = await new Promise<Array<{ [key: string]: string }>>(
      (resolve, reject) => {
        const rows: Array<{ [key: string]: string }> = []
        const stream = parse({ headers: true, delimiter: ',' })
          .on('error', reject)
          .on('data', (row) => rows.push(row))
          .on('end', () => resolve(rows))
        stream.write(data)
        stream.end()
      }
    )
    await listRepository.importList(listName, indexName, rows)

    return 'OK'
  }
)
