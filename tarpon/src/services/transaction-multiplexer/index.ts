import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import uniq from 'lodash/uniq'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { backOff } from 'exponential-backoff'
import pMap from 'p-map'
import { v4 as uuid } from 'uuid'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { buildGroups, getPrimaryRecordIdentifier } from './multiplexer-utils'
import { TransactionMultiplexerRepository } from './repository'
import {
  FifoSqsMessage,
  bulkSendMessages,
  getSQSClient,
} from '@/utils/sns-sqs-client'
import {
  AsyncMessage,
  BatchItemFailure,
} from '@/@types/rule/async-rule-multiplexer'
import { logger } from '@/core/logger'

const MAX_CONCURRENCY = 20

class ConflictingMessageGroupRetryError extends Error {
  constructor() {
    super()
    this.name = 'ConflictingMessageGroupRetryError'
  }
}

const sqsClient = getSQSClient()

export class TransactionMultiplexer {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private multiplexerRepository: TransactionMultiplexerRepository
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb

    this.multiplexerRepository = new TransactionMultiplexerRepository(
      this.tenantId,
      this.dynamoDb
    )
  }

  public async handleTenantRecords(
    asyncMessages: AsyncMessage[]
  ): Promise<BatchItemFailure[]> {
    const batchItemFailures: BatchItemFailure[] = []
    const rulesInstanceRepository = new RuleInstanceRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const aggregationVariables =
      await rulesInstanceRepository.getAllAggregationVariables()
    const aggregationTypes = uniq(
      aggregationVariables.map((aggVar) => {
        return aggVar.type
      })
    )
    const { groups, identifierToRecordMap } = buildGroups(
      asyncMessages,
      aggregationTypes
    )
    await pMap(
      groups,
      async (group) => {
        const { group: recordGroup, identifiers } = group
        if (identifiers.length === 0 && recordGroup.length === 1) {
          // Handle no identifier transactions
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(recordGroup[0].record),
              MessageGroupId: uuid(),
              MessageDeduplicationId: getPrimaryRecordIdentifier(
                recordGroup[0].record
              ),
              QueueUrl: process.env.ASYNC_RULE_PROCESSOR_QUEUE_URL as string,
            })
          )
          return
        }
        const dedupedIdentifiers = uniq(identifiers)
        try {
          await backOff(
            async () =>
              await this.handleConnectedGroup(
                recordGroup,
                dedupedIdentifiers,
                identifierToRecordMap
              ),
            {
              numOfAttempts: 10,
              maxDelay: 60 * 1000,
              startingDelay: 1 * 1000,
              timeMultiple: 2,
            }
          )
        } catch (e) {
          logger.info(
            `Sending batchFailure for ${recordGroup
              .map((item) => getPrimaryRecordIdentifier(item.record))
              .join(', ')} `
          )
          batchItemFailures.push(
            ...recordGroup.map(
              (record): BatchItemFailure => ({
                itemIdentifier: record.messageId,
              })
            )
          )
          return
        }
      },
      { concurrency: MAX_CONCURRENCY }
    )

    return batchItemFailures
  }

  private async handleConnectedGroup(
    records: AsyncMessage[],
    dedupedIdentifiers: string[],
    identifierToRecordMap: { [key: string]: string[] }
  ) {
    const identifiersStatusDetails =
      await this.multiplexerRepository.getIdentifiersProcessingDetails(
        dedupedIdentifiers
      )
    const groupIdsInvolved = uniq(
      identifiersStatusDetails.map((details) => details.groupId)
    )
    if (groupIdsInvolved.length <= 1) {
      // Case when no identifer is being processed
      const groupId =
        groupIdsInvolved.length == 0 ? uuid() : groupIdsInvolved[0]
      await this.multiplexerRepository.markIdentifiersAsProcessing(
        dedupedIdentifiers,
        groupId,
        (identifier: string) => {
          return identifierToRecordMap[identifier] ?? []
        }
      )
      const messages: FifoSqsMessage[] = records.map((record) => ({
        MessageBody: JSON.stringify(record.record),
        MessageGroupId: groupId,
        MessageDeduplicationId: getPrimaryRecordIdentifier(record.record),
      }))
      await bulkSendMessages(
        sqsClient,
        process.env.ASYNC_RULE_PROCESSOR_QUEUE_URL as string,
        messages
      )
    } else {
      // Case when identifiers are being run in conflicting messageGroups
      throw new ConflictingMessageGroupRetryError()
    }
  }
}
