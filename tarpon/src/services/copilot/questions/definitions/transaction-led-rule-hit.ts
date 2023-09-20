import { sortBy } from 'lodash'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'

export const TransactionLedRuleHit: TableQuestion<any> = {
  type: 'TABLE',
  questionId: 'Transactions leading to rule hit',
  title: (ctx) => {
    return `Transactions that led to "${ctx.alert.ruleName}" rule hit`
  },
  headers: [
    {
      name: 'ID',
      columnType: 'STRING',
    },
    {
      name: 'Amount',
      columnType: 'NUMBER',
    },
    {
      name: 'Timestamp',
      columnType: 'DATE_TIME',
    },
  ],
  aggregationPipeline: async ({ tenantId, userId, alert }) => {
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const rir = new RuleInstanceRepository(tenantId, { dynamoDb })
    const dynamoDbTransactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )

    const ruleInstance = await rir.getRuleInstanceById(alert.ruleInstanceId)
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, client)

    const transactionsBeforeHit = await client
      .db()
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        $or: [
          {
            originUserId: userId,
          },
          {
            destinationUserId: userId,
          },
        ],
        createdAt: {
          $lt: alert.createdTimestamp,
        },
      })
      .toArray()

    const dynamoTxn = await dynamoDbTransactionRepository.getTransactionsByIds(
      transactionsBeforeHit.map((t) => t.transactionId)
    )
    const transactionsThatLedToRuleHit = dynamoTxn.filter(
      async (transaction) => {
        const result = await rulesEngine.computeRuleFilters(
          ruleInstance?.filters,
          {
            transaction,
          }
        )
        return result.isTransactionFiltered
      }
    )

    return sortBy(transactionsThatLedToRuleHit, 'timestamp')
      .reverse()
      .map((t) => {
        return [
          t.transactionId,
          `${t.originAmountDetails?.transactionAmount}`,
          t.timestamp,
        ]
      })
  },
  variableOptions: {},
  defaults: () => {
    return {}
  },
}
