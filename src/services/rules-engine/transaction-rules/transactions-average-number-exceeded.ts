import TransactionAverageExceededRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'

export default class TransactionAverageNumberExceededRule extends TransactionAverageExceededRule {
  transactionRepository?: TransactionRepository

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    params: {
      parameters: TransactionsAverageExceededParameters
      action: RuleAction
    },
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    super(tenantId, data, params, dynamoDb, 'NUMBER')
  }
}
