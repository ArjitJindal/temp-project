import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { groupBy } from 'lodash'
import {
  hasFeature,
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '../utils/context'
import { logger } from '../logger'
import { NangoRecord } from '../../@types/nango'
import {
  DynamoDbEntityUpdate,
  getDynamoDbUpdates,
  savePartitionKey,
} from './dynamodb-stream-utils'
import { ALERT_COMMENT_KEY_IDENTIFIER, ALERT_ID_PREFIX } from './dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import { bulkSendMessages, getSQSClient } from '@/utils/sns-sqs-client'
import { envIs, envIsNot } from '@/utils/env'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { acquireLock, releaseLock } from '@/utils/lock'
import { generateChecksum } from '@/utils/object'
import { Alert } from '@/@types/openapi-internal/Alert'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { Comment } from '@/@types/openapi-internal/Comment'

export type DbClients = {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
}

export type RuleStats = {
  hitRulesInstanceIds?: string[]
  executedRulesInstanceIds?: string[]
}

type TransactionHandler = (
  tenantId: string,
  oldTransaction: TransactionWithRulesResult | undefined,
  newTransaction: TransactionWithRulesResult | undefined,
  dbClients: DbClients
) => Promise<void>
type TransactionsHandler = (
  tenantId: string,
  newTransactions: TransactionWithRulesResult[],
  dbClients: DbClients
) => Promise<void>
type NangoRecordHandler = (
  tenantId: string,
  newNangoRecords: Omit<NangoRecord & object, 'data'>,
  dbClients: DbClients
) => Promise<void>
type TransactionEventHandler = (
  tenantId: string,
  oldTransactionEvent: TransactionEvent | undefined,
  newTransactionEvent: TransactionEvent | undefined,
  dbClients: DbClients
) => Promise<void>
type UserHandler = (
  tenantId: string,
  oldUser: UserWithRulesResult | BusinessWithRulesResult | undefined,
  newUser: UserWithRulesResult | BusinessWithRulesResult | undefined,
  dbClients: DbClients
) => Promise<void>
type UsersHandler = (
  tenantId: string,
  newUsers: Array<UserWithRulesResult | BusinessWithRulesResult>,
  dbClients: DbClients
) => Promise<void>
type AlertsHandler = (
  tenantId: string,
  newAlerts: Array<Alert>,
  dbClients: DbClients
) => Promise<void>
type UserEventHandler = (
  tenantId: string,
  oldUserEvent: ConsumerUserEvent | undefined,
  newUserEvent: ConsumerUserEvent | undefined,
  dbClients: DbClients
) => Promise<void>
type ArsScoreEventHandler = (
  tenantId: string,
  oldArsValue: ArsScore | undefined,
  newArsValue: ArsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type DrsScoreEventHandler = (
  tenantId: string,
  oldDrsValue: DrsScore | undefined,
  newDrsValue: DrsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type KrsScoreEventHandler = (
  tenantId: string,
  oldKrsValue: KrsScore | undefined,
  newKrsValue: KrsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type AvgArsScoreEventHandler = (
  tenantId: string,
  oldAvgArsValue: AverageArsScore | undefined,
  newAvgArsValue: AverageArsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type RuleInstanceHandler = (
  tenantId: string,
  oldRuleInstance: RuleInstance | undefined,
  newRuleInstance: RuleInstance | undefined,
  dbClients: DbClients
) => Promise<void>
type AlertHandler = (
  tenantId: string,
  oldAlert: Alert | undefined,
  newAlert: Alert | undefined,
  dbClients: DbClients
) => Promise<void>
type AlertCommentHandler = (
  tenantId: string,
  alertId: string,
  oldAlertComment: Comment | undefined,
  newAlertComment: Comment | undefined,
  dbClients: DbClients
) => Promise<void>
type AlertFileHandler = (
  tenantId: string,
  alertId: string,
  commentId: string,
  oldAlertFile: FileInfo | undefined,
  newAlertFile: FileInfo | undefined,
  dbClients: DbClients
) => Promise<void>
type ConcurrentGroupBy = (update: DynamoDbEntityUpdate) => string

const sqsClient = getSQSClient()

export class StreamConsumerBuilder {
  name: string
  fanOutSqsQueue: string
  getTableName: (tenantId: string) => string
  transactionHandler?: TransactionHandler
  transactionsHandler?: TransactionsHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHandler
  usersHandler?: UsersHandler
  userEventHandler?: UserEventHandler
  arsScoreEventHandler?: ArsScoreEventHandler
  drsScoreEventHandler?: DrsScoreEventHandler
  krsScoreEventHandler?: KrsScoreEventHandler
  avgArsScoreEventHandler?: AvgArsScoreEventHandler
  ruleInstanceHandler?: RuleInstanceHandler
  concurrentGroupBy?: ConcurrentGroupBy
  alertHandler?: AlertHandler
  alertsHandler?: AlertsHandler
  alertCommentHandler?: AlertCommentHandler
  alertFileHandler?: AlertFileHandler
  nangoRecordHandler?: NangoRecordHandler

  constructor(
    name: string,
    fanOutSqsQueue: string,
    getTableName: (tenantId: string) => string
  ) {
    this.name = name
    this.fanOutSqsQueue = fanOutSqsQueue
    this.handleDynamoDbUpdate = this.handleDynamoDbUpdate.bind(this)
    this.getTableName = getTableName
  }

  public setConcurrentGroupBy(
    concurrentGroupBy: ConcurrentGroupBy
  ): StreamConsumerBuilder {
    this.concurrentGroupBy = concurrentGroupBy
    return this
  }

  public setTransactionHandler(
    transactionHandler: TransactionHandler
  ): StreamConsumerBuilder {
    this.transactionHandler = transactionHandler
    return this
  }
  public setTransactionsHandler(
    transactionsHandler: TransactionsHandler
  ): StreamConsumerBuilder {
    this.transactionsHandler = transactionsHandler
    return this
  }
  public setTransactionEventHandler(
    transactionEventHandler: TransactionEventHandler
  ): StreamConsumerBuilder {
    this.transactionEventHandler = transactionEventHandler
    return this
  }
  public setUserHandler(userHandler: UserHandler): StreamConsumerBuilder {
    this.userHandler = userHandler
    return this
  }
  public setUsersHandler(usersHandler: UsersHandler): StreamConsumerBuilder {
    this.usersHandler = usersHandler
    return this
  }
  public setUserEventHandler(
    userEventHandler: UserEventHandler
  ): StreamConsumerBuilder {
    this.userEventHandler = userEventHandler
    return this
  }
  public setArsScoreEventHandler(
    arsScoreEventHandler: ArsScoreEventHandler
  ): StreamConsumerBuilder {
    this.arsScoreEventHandler = arsScoreEventHandler
    return this
  }
  public setDrsScoreEventHandler(
    drsScoreEventHandler: DrsScoreEventHandler
  ): StreamConsumerBuilder {
    this.drsScoreEventHandler = drsScoreEventHandler
    return this
  }
  public setKrsScoreEventHandler(
    krsScoreEventHandler: KrsScoreEventHandler
  ): StreamConsumerBuilder {
    this.krsScoreEventHandler = krsScoreEventHandler
    return this
  }
  public setAvgArsScoreEventHandler(
    avgArsScoreEventHandler: AvgArsScoreEventHandler
  ): StreamConsumerBuilder {
    this.avgArsScoreEventHandler = avgArsScoreEventHandler
    return this
  }
  public setRuleInstanceHandler(
    ruleInstanceHandler: RuleInstanceHandler
  ): StreamConsumerBuilder {
    this.ruleInstanceHandler = ruleInstanceHandler
    return this
  }

  public setAlertHandler(alertHandler: AlertHandler): StreamConsumerBuilder {
    this.alertHandler = alertHandler
    return this
  }

  public setAlertsHandler(alertsHandler: AlertsHandler): StreamConsumerBuilder {
    this.alertsHandler = alertsHandler
    return this
  }

  public setAlertCommentHandler(
    alertCommentHandler: AlertCommentHandler
  ): StreamConsumerBuilder {
    this.alertCommentHandler = alertCommentHandler
    return this
  }

  public setAlertFileHandler(
    alertFileHandler: AlertFileHandler
  ): StreamConsumerBuilder {
    this.alertFileHandler = alertFileHandler
    return this
  }

  public setNangoRecordHandler(
    nangoRecordHandler: NangoRecordHandler
  ): StreamConsumerBuilder {
    this.nangoRecordHandler = nangoRecordHandler
    return this
  }

  private async handleDynamoDbUpdates(
    updates: DynamoDbEntityUpdate[],
    dbClients: DbClients
  ) {
    const concurrentGroups = groupBy(
      updates,
      this.concurrentGroupBy ?? (() => 'sequential-group')
    )
    await Promise.all(
      Object.values(concurrentGroups).map(async (groupUpdates) => {
        for (const update of groupUpdates) {
          if (update.entityId && envIsNot('test', 'local')) {
            await acquireLock(dbClients.dynamoDb, update.entityId)
          }
          try {
            await this.handleDynamoDbUpdate(update, dbClients)
          } finally {
            if (update.entityId && envIsNot('test', 'local')) {
              await releaseLock(dbClients.dynamoDb, update.entityId)
            }
          }
        }
        await this.handleDynamoDbUpdateGroup(groupUpdates, dbClients)
      })
    )
  }

  private async handleDynamoDbUpdateGroup(
    groupUpdates: DynamoDbEntityUpdate[],
    dbClients: DbClients
  ) {
    if (this.transactionsHandler) {
      const transactionUpdates = groupUpdates.filter(
        (update) => update.type === 'TRANSACTION'
      )
      if (transactionUpdates.length > 0) {
        const transactions = transactionUpdates.map(
          (update) => update.NewImage as TransactionWithRulesResult
        )
        await this.transactionsHandler(
          transactionUpdates[0].tenantId,
          transactions,
          dbClients
        )
      }
    }
    if (this.usersHandler) {
      const userUpdates = groupUpdates.filter(
        (update) => update.type === 'USER'
      )
      if (userUpdates.length > 0) {
        const users = userUpdates.map(
          (update) =>
            update.NewImage as UserWithRulesResult | BusinessWithRulesResult
        )
        await this.usersHandler(userUpdates[0].tenantId, users, dbClients)
      }
    }
    if (this.alertsHandler) {
      const alertUpdates = groupUpdates.filter(
        (update) => update.type === 'ALERT'
      )
      if (alertUpdates.length > 0) {
        const alerts = alertUpdates.map((update) => update.NewImage as Alert)
        await this.alertsHandler(alertUpdates[0].tenantId, alerts, dbClients)
      }
    }
  }

  private async handleDynamoDbUpdate(
    update: DynamoDbEntityUpdate,
    dbClients: DbClients
  ): Promise<any> {
    updateLogMetadata({ entityId: update.entityId })
    if (update.type === 'TRANSACTION' && this.transactionHandler) {
      return await this.transactionHandler(
        update.tenantId,
        update.OldImage as TransactionWithRulesResult,
        update.NewImage as TransactionWithRulesResult,
        dbClients
      )
    } else if (
      update.type === 'TRANSACTION_EVENT' &&
      this.transactionEventHandler
    ) {
      await this.transactionEventHandler(
        update.tenantId,
        update.OldImage as TransactionEvent,
        update.NewImage as TransactionEvent,
        dbClients
      )
    } else if (update.type === 'USER' && this.userHandler) {
      return await this.userHandler(
        update.tenantId,
        update.OldImage as UserWithRulesResult,
        update.NewImage as UserWithRulesResult,
        dbClients
      )
    } else if (
      (update.type === 'CONSUMER_USER_EVENT' ||
        update.type === 'BUSINESS_USER_EVENT') &&
      this.userEventHandler
    ) {
      await this.userEventHandler(
        update.tenantId,
        update.OldImage as ConsumerUserEvent | BusinessUserEvent,
        update.NewImage as ConsumerUserEvent | BusinessUserEvent,
        dbClients
      )
    } else if (update.type === 'ARS_VALUE' && this.arsScoreEventHandler) {
      await this.arsScoreEventHandler(
        update.tenantId,
        update.OldImage as ArsScore,
        update.NewImage as ArsScore,
        dbClients
      )
    } else if (update.type === 'DRS_VALUE' && this.drsScoreEventHandler) {
      await this.drsScoreEventHandler(
        update.tenantId,
        update.OldImage as DrsScore,
        update.NewImage as DrsScore,
        dbClients
      )
    } else if (update.type === 'KRS_VALUE' && this.krsScoreEventHandler) {
      await this.krsScoreEventHandler(
        update.tenantId,
        update.OldImage as KrsScore,
        update.NewImage as KrsScore,
        dbClients
      )
    } else if (
      update.type === 'AVG_ARS_VALUE' &&
      this.avgArsScoreEventHandler
    ) {
      await this.avgArsScoreEventHandler(
        update.tenantId,
        update.OldImage as AverageArsScore,
        update.NewImage as AverageArsScore,
        dbClients
      )
    } else if (update.type === 'RULE_INSTANCE' && this.ruleInstanceHandler) {
      await this.ruleInstanceHandler(
        update.tenantId,
        update.OldImage as RuleInstance,
        update.NewImage as RuleInstance,
        dbClients
      )
    } else if (update.type === 'ALERT' && this.alertHandler) {
      await this.alertHandler(
        update.tenantId,
        update.OldImage as Alert,
        update.NewImage as Alert,
        dbClients
      )
    } else if (update.type === 'ALERT_COMMENT' && this.alertCommentHandler) {
      const alertId = update.entityId
        ?.split(ALERT_ID_PREFIX)[1]
        .split(ALERT_COMMENT_KEY_IDENTIFIER)[0]

      if (!alertId) {
        logger.error(`Cannot get alert ID from entity ID: ${update.entityId}`)
        return
      }

      await this.alertCommentHandler(
        update.tenantId,
        alertId,
        update.OldImage as Comment,
        update.NewImage as Comment,
        dbClients
      )
    } else if (update.type === 'ALERT_FILE' && this.alertFileHandler) {
      const alertId = update.entityId?.split(ALERT_ID_PREFIX)[1]
      const commentId = update.sortKeyId?.split('#')[0]

      if (!alertId || !commentId) {
        logger.error(
          `Cannot get alert ID or file ID from entity ID: ${update.entityId}`
        )
        return
      }

      await this.alertFileHandler(
        update.tenantId,
        alertId,
        commentId,
        update.OldImage as FileInfo,
        update.NewImage as FileInfo,
        dbClients
      )
    } else if (update.type === 'NANGO_RECORD' && this.nangoRecordHandler) {
      await this.nangoRecordHandler(
        update.tenantId,
        update.NewImage as NangoRecord,
        dbClients
      )
    }
  }

  public buildSqsFanOutHandler() {
    return async (event: SQSEvent) => {
      const updates = event.Records.map(
        (record) => JSON.parse(record.body) as DynamoDbEntityUpdate
      )
      const groups = groupBy(updates, (update) => update.tenantId)
      await Promise.all(
        Object.entries(groups).map(async (entry) => {
          const tenantId = entry[0]
          const tenantUpdates = entry[1]
          await this.handleSqsDynamoUpdates(tenantId, tenantUpdates)
        })
      )
    }
  }

  public buildKinesisStreamHandler() {
    return async (event: KinesisStreamEvent) => {
      const updates = getDynamoDbUpdates(event)
      const groups = groupBy(updates, (update) => update.tenantId)
      await Promise.all(
        Object.entries(groups).map(async (entry) => {
          const tenantId = entry[0]
          const tenantUpdates = entry[1]
          await this.handleKinesisDynamoUpdates(tenantId, tenantUpdates)
        })
      )
    }
  }

  private async handleSqsDynamoUpdates(
    tenantId: string,
    updates: DynamoDbEntityUpdate[]
  ) {
    await withContext(async () => {
      const dbClients: DbClients = {
        dynamoDb: getDynamoDbClient(),
        mongoDb: await getMongoDbClient(),
      }
      await initializeTenantContext(tenantId)
      await this.handleDynamoDbUpdates(updates, dbClients)
    })
  }

  private async handleKinesisDynamoUpdates(
    tenantId: string,
    updates: DynamoDbEntityUpdate[]
  ) {
    const tableName = this.getTableName(tenantId)
    await withContext(async () => {
      const dbClients: DbClients = {
        dynamoDb: getDynamoDbClient(),
        mongoDb: await getMongoDbClient(),
      }
      await initializeTenantContext(tenantId)
      const filteredUpdates = updates.filter(Boolean)
      await Promise.all(
        filteredUpdates.map(async (update) => {
          /**   Store DynamoDB Keys in MongoDB * */
          if (
            update.NewImage &&
            !update.NewImage.ttl &&
            !tableName.includes(tenantId) // Stands for Silo Tables
          ) {
            await savePartitionKey(
              update.tenantId,
              update.partitionKeyId,
              tableName
            )
          }
        })
      )

      if (envIs('local', 'test')) {
        await this.handleDynamoDbUpdates(filteredUpdates, dbClients)
        return
      }

      const entries = filteredUpdates
        .filter((update) => update.type && !update.NewImage?.ttl)
        .map((update) => ({
          MessageBody: JSON.stringify(update),
          MessageGroupId: hasFeature('CONCURRENT_DYNAMODB_CONSUMER')
            ? generateChecksum(update.entityId, 10)
            : generateChecksum(update.tenantId, 10),
          MessageDeduplicationId: `${generateChecksum(
            update.entityId,
            10
          )}-${generateChecksum(update.sequenceNumber, 10)}`,
        }))
      await bulkSendMessages(sqsClient, this.fanOutSqsQueue, entries)
    })
  }
}
