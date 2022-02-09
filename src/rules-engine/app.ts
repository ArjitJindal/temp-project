import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { Transaction } from '../@types/openapi/transaction'
import { TransactionMonitoringResult } from '../@types/openapi/transactionMonitoringResult'
import { getDynamoDbClient } from '../utils/dynamodb'
import { RuleActionEnum } from '../@types/rule/rule-instance'
import { Aggregators } from './aggregator'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { rules } from './rules'

async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<TransactionMonitoringResult> {
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
      )
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

  // TODO: Refactor the following logic to be event-driven
  const transactionId = await transactionRepository.saveTransaction(transaction)
  await Promise.all(
    Aggregators.map((Aggregator) =>
      new Aggregator(tenantId, transaction, dynamoDb).aggregate()
    )
  )

  return {
    transactionId,
    executedRules: ruleResults,
    // TODO: Handle failed rules
    failedRules: [],
  }
}

export const transactionHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
  const { principalId: tenantId } = event.requestContext.authorizer
  const dynamoDb = getDynamoDbClient(event)
  const transactionId = event.pathParameters?.transactionId

  try {
    if (event.httpMethod === 'POST' && event.body) {
      const transaction = JSON.parse(event.body)
      // TODO: Validate payload
      const result = await verifyTransaction(transaction, tenantId, dynamoDb)
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      }
    } else if (event.httpMethod === 'GET' && transactionId) {
      const transactionRepository = new TransactionRepository(
        tenantId,
        dynamoDb
      )
      const result = await transactionRepository.getTransactionById(
        transactionId
      )
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      }
    }
    return {
      statusCode: 500,
      body: 'Unhandled request',
    }
  } catch (err) {
    console.log(err)
    const errMessage = err instanceof Error ? err.message : err
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errMessage,
      }),
    }
  }
}

export type RuleInstanceQueryStringParameters = {
  tenantId: string
}
