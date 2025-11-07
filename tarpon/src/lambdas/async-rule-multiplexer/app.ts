import { SQSEvent } from 'aws-lambda'
import groupBy from 'lodash/groupBy'
import flatten from 'lodash/flatten'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  AsyncRuleRecordTransaction,
  AsyncRuleRecordTransactionEvent,
} from '@/@types/batch-import'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TransactionMultiplexer } from '@/services/transaction-multiplexer'

export const asyncRuleMultiplexer = lambdaConsumer()(
  async (event: SQSEvent) => {
    const asyncMessages = event.Records.map((record) => ({
      messageId: record.messageId,
      record: JSON.parse(record.body) as (
        | AsyncRuleRecordTransaction
        | AsyncRuleRecordTransactionEvent
      ) & { tenantId: string },
    }))
    const dynamoDb = getDynamoDbClient()
    const tenantGroupedMessages = groupBy(
      asyncMessages,
      (asyncMessage) => asyncMessage.record.tenantId
    )
    const results = await Promise.all(
      Object.entries(tenantGroupedMessages).map(
        async ([tenantId, asyncMessages]) => {
          const transactionMultiplexer = new TransactionMultiplexer(
            tenantId,
            dynamoDb
          )
          return transactionMultiplexer.handleTenantRecords(asyncMessages)
        }
      )
    )
    return { batchItemFailures: flatten(results) }
  }
)
