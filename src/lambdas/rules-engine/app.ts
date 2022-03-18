import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Transaction } from '../../@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '../../@types/openapi-public/TransactionMonitoringResult'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { RuleActionEnum, RuleParameters } from '../../@types/rule/rule-instance'
import { ExecutedRulesResult } from '../../@types/openapi-public/ExecutedRulesResult'
import { FailedRulesResult } from '../../@types/openapi-public/FailedRulesResult'
import { lambdaApi } from '../../core/middlewares/lambda-api-middlewares'
import { Aggregators } from './aggregator'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { rules } from './rules'
import { RuleError } from './rules/errors'

const ruleAscendingComparator = (
  rule1: ExecutedRulesResult | FailedRulesResult,
  rule2: ExecutedRulesResult | FailedRulesResult
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

// TODO: Move it to an abstraction layer
export async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<TransactionMonitoringResult> {
  const ruleRepository = new RuleRepository(tenantId, dynamoDb)
  const transactionRepository = new TransactionRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = await ruleRepository.getActiveRuleInstances()
  const ruleResults = await Promise.all(
    ruleInstances.map(async (ruleInstance) => {
      const rule = new rules[ruleInstance.ruleId](
        tenantId,
        transaction,
        ruleInstance.parameters as RuleParameters,
        dynamoDb
      )
      const { displayName, description } = rule.getInfo()
      try {
        const ruleResult = await rule.computeRule()
        return {
          ruleId: ruleInstance.ruleId,
          ruleName: displayName,
          ruleDescription: description,
          ruleAction: ruleResult?.action || RuleActionEnum.ALLOW,
          ruleHit: ruleResult !== undefined,
        }
      } catch (e) {
        console.error(e)
        return {
          ruleId: ruleInstance.ruleId,
          ruleName: displayName,
          ruleDescription: description,
          failureException:
            e instanceof RuleError
              ? { exceptionName: e.name, exceptionDescription: e.message }
              : { exceptionName: 'Unknown', exceptionDescription: 'Unknown' },
        }
      }
    })
  )
  const executedRules = ruleResults
    .filter((result) => result.ruleAction)
    .sort(ruleAscendingComparator) as ExecutedRulesResult[]
  const failedRules = ruleResults
    .filter((result) => !result.ruleAction)
    .sort(ruleAscendingComparator) as FailedRulesResult[]

  // TODO: Refactor the following logic to be event-driven
  const transactionId = await transactionRepository.saveTransaction(
    transaction,
    {
      executedRules,
      failedRules,
    }
  )
  await Promise.all(
    Aggregators.map((Aggregator) =>
      new Aggregator(tenantId, transaction, dynamoDb).aggregate()
    )
  )

  return {
    transactionId,
    executedRules: executedRules,
    failedRules: failedRules,
  }
}

export const transactionHandler = lambdaApi()(
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
        const result = await verifyTransaction(transaction, tenantId, dynamoDb)
        return result
      } else if (event.httpMethod === 'GET' && transactionId) {
        const transactionRepository = new TransactionRepository(tenantId, {
          dynamoDb,
        })
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
