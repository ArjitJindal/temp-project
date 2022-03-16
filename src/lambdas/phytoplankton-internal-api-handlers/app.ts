import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RuleInstanceQueryStringParameters } from '../rules-engine/app'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'
import { RuleRepository } from '../rules-engine/repositories/rule-repository'
import { compose } from '../../core/middlewares/compose'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'
import { connectToDB } from '../../utils/docDBUtils'
import { DefaultApiGetTransactionsListRequest } from '../../@types/openapi-internal/RequestParameters'
import { TransactionsListResponse } from '../../@types/openapi-internal/TransactionsListResponse'

export const transactionsViewHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<TransactionsListResponse> => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const params =
      event.queryStringParameters as unknown as DefaultApiGetTransactionsListRequest
    const client = await connectToDB()
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb: client,
    })
    return transactionRepository.getTransactions(params)
  }
)

export const ruleInstanceHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { tenantId } =
      event.queryStringParameters as RuleInstanceQueryStringParameters
    const dynamoDb = getDynamoDbClient(event)
    const ruleRepository = new RuleRepository(tenantId, dynamoDb)
    const ruleInstanceId = event.pathParameters?.id

    if (event.httpMethod === 'PUT' && ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      await ruleRepository.createOrUpdateRuleInstance({
        id: ruleInstanceId,
        ...JSON.parse(event.body),
      })
      return 'OK'
    } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
      await ruleRepository.deleteRuleInstance(ruleInstanceId)
      return 'OK'
    } else if (event.httpMethod === 'POST' && !ruleInstanceId) {
      if (!event.body) {
        throw new Error('missing payload!')
      }
      const newRuleInstance = await ruleRepository.createOrUpdateRuleInstance(
        JSON.parse(event.body)
      )
      return newRuleInstance
    }

    throw new Error('Unhandled request')
  }
)
