import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { RuleInstanceQueryStringParameters } from '../rules-engine/app'
import { getDynamoDbClient } from '../utils/dynamodb'
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'

export const transactionsViewHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
  const { tenantId } =
    event.queryStringParameters as RuleInstanceQueryStringParameters
  const dynamoDb = getDynamoDbClient(event)
  const transactionRepository = new TransactionRepository(tenantId, dynamoDb)

  if (event.httpMethod === 'GET') {
    if (!event.body) {
      throw new Error('missing payload!')
    }
    /*Implementation Pending*/
    return {
      statusCode: 200,
      body: 'OK',
    }
  }

  throw new Error('Unhandled request')
}

export const ruleInstanceHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
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
    return {
      statusCode: 200,
      body: 'OK',
    }
  } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
    await ruleRepository.deleteRuleInstance(ruleInstanceId)
    return {
      statusCode: 200,
      body: 'OK',
    }
  } else if (event.httpMethod === 'POST' && !ruleInstanceId) {
    if (!event.body) {
      throw new Error('missing payload!')
    }
    const newRuleInstance = await ruleRepository.createOrUpdateRuleInstance(
      JSON.parse(event.body)
    )
    return {
      statusCode: 200,
      body: JSON.stringify(newRuleInstance),
    }
  }

  throw new Error('Unhandled request')
}
