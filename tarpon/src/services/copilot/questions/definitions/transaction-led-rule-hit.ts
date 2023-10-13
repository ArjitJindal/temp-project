import { sortBy } from 'lodash'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const TransactionLedRuleHit: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Transactions leading to rule hit',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (ctx) => {
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
  aggregationPipeline: async (
    { tenantId, userId, alert, username },
    period
  ) => {
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const rir = new RuleInstanceRepository(tenantId, { dynamoDb })

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
        ...matchPeriod('createdAt', period),
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const transactionsThatLedToRuleHit = transactionsBeforeHit.filter(
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

    return {
      data: sortBy(transactionsThatLedToRuleHit, 'timestamp')
        .reverse()
        .map((t) => {
          return [
            t.transactionId,
            `${t.originAmountDetails?.transactionAmount}`,
            t.timestamp,
          ]
        }),
      summary: `${transactionsThatLedToRuleHit.length} transactions were checked before the alert was created for ${username}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
