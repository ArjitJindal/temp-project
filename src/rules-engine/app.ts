import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Rule, RuleActionEnum } from './rules/rule'
import { RuleComputeResult } from '../@types/rule/ruleComputeResult'
import { RuleRepository } from './repositories/ruleRepository'
import { Transaction } from '../@types/transaction/transaction'
import { TransactionRepository } from './repositories/transactionRepository'
import { getDynamoDbClient } from '../utils/dynamodb'
import { rules } from './rules'

async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<RuleComputeResult> {
  const ruleRepository = new RuleRepository(tenantId, dynamoDb)
  const transactionRepository = new TransactionRepository(tenantId, dynamoDb)
  const ruleInstances = await ruleRepository.getActiveRuleInstances()
  const ruleResults = await Promise.all(
    ruleInstances.map(async (ruleInstance) => {
      const rule = new rules[ruleInstance.ruleId](
        tenantId,
        transaction,
        ruleInstance.parameters,
        dynamoDb
      ) as Rule
      const ruleResult = await rule.computeRule()
      const { name, description } = rule.getInfo()
      return {
        ruleId: ruleInstance.ruleId,
        ruleName: name,
        ruleDescription: description,
        ruleAction: ruleResult?.action || RuleActionEnum.ALLOW,
        ruleHit: ruleResult !== undefined,
      }
    })
  )
  const transactionId = await transactionRepository.saveTransaction(transaction)
  return {
    transactionId,
    rules: ruleResults,
  }
}

export const verifyTransactionHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
  const { principalId: tenantId } = event.requestContext.authorizer
  const dynamoDb = getDynamoDbClient(event)

  try {
    const transaction = event.body && JSON.parse(event.body)
    // TODO: Validate payload
    const result = await verifyTransaction(transaction, tenantId, dynamoDb)
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    }
  } catch (err: any) {
    console.log(err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    }
  }
}

export type RuleInstanceQueryStringParameters = {
  tenantId: string
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
    await ruleRepository.createOrUpdateRuleInstance(JSON.parse(event.body))
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
