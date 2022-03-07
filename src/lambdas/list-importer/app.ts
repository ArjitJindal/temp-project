import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { parse } from '@fast-csv/parse'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { compose } from '../../core/middlewares/compose'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'
import { ListRepository } from './repositories/list-repository'

export const listImporterHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    // TODO: Validate payload
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
