import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Transaction } from '../../@types/openapi-public/transaction'
import { TransactionMonitoringResult } from '../../@types/openapi-public/transactionMonitoringResult'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { RuleActionEnum, RuleParameters } from '../../@types/rule/rule-instance'
import { compose } from '../../core/middlewares/compose'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'
import { Aggregators } from './aggregator'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { rules } from './rules'

// TODO: Move it to an abstraction layer
export async function verifyTransaction(
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
        ruleInstance.parameters as RuleParameters,
        dynamoDb
      )
      const ruleResult = await rule.computeRule()
      const { displayName, description } = rule.getInfo()
      return {
        ruleId: ruleInstance.ruleId,
        ruleName: displayName,
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
    executedRules: ruleResults.sort((rule1, rule2) =>
      rule1.ruleId > rule2.ruleId ? 1 : -1
    ),
    // TODO: Handle failed rules
    failedRules: [],
  }
}

export const transactionHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const transactionId = event.pathParameters?.transactionId

    try {
      if (event.httpMethod === 'POST' && event.body) {
        const transaction = JSON.parse(event.body)
        // TODO: Validate payload
        const result = await verifyTransaction(transaction, tenantId, dynamoDb)
        return result
      } else if (event.httpMethod === 'GET' && transactionId) {
        const transactionRepository = new TransactionRepository(
          tenantId,
          dynamoDb
        )
        const result = await transactionRepository.getTransactionById(
          transactionId
        )
        return result
      }
      return 'Unhandled request'
    } catch (err) {
      console.log(err)
      const errMessage = err instanceof Error ? err.message : err
      return {
        error: errMessage,
      }
    }
  }
)

export type RuleInstanceQueryStringParameters = {
  tenantId: string
}
