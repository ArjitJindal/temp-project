import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import compact from 'lodash/compact'
import groupBy from 'lodash/groupBy'
import { StackConstants } from '@lib/constants'
import { backOff } from 'exponential-backoff'
import {
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '../utils/context'
import { addNewSubsegment, traceable } from '../xray'
import {
  DynamoDbEntityUpdate,
  getDynamoDbUpdates,
  LOCK_FREE_ENTITIES,
  savePartitionKey,
} from './dynamodb-stream-utils'
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
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { CRMRecordLink } from '@/@types/openapi-internal/CRMRecordLink'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { Notification } from '@/@types/openapi-internal/Notification'
import { LLMLogObject } from '@/utils/llms'
import { TenantService } from '@/services/tenants'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'

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
  oldTransactions: TransactionWithRulesResult[],
  newTransactions: TransactionWithRulesResult[],
  dbClients: DbClients
) => Promise<void>
type CrmRecordHandler = (
  tenantId: string,
  newCrmRecords: CRMRecord,
  dbClients: DbClients
) => Promise<void>
type CrmUserRecordLinkHandler = (
  tenantId: string,
  crmRecordLink: CRMRecordLink,
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
  oldUsers: Array<UserWithRulesResult | BusinessWithRulesResult>,
  newUsers: Array<UserWithRulesResult | BusinessWithRulesResult>,
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
type AlertsQaSamplingHandler = (
  tenantId: string,
  oldAlertQaSampling: AlertsQaSampling | undefined,
  newAlertQaSampling: AlertsQaSampling | undefined,
  dbClients: DbClients
) => Promise<void>
type NotificationsHandler = (
  tenantId: string,
  oldNotifications: Notification | undefined,
  newNotifications: Notification | undefined,
  dbClients: DbClients
) => Promise<void>
type LLMRequestsHandler = (
  tenantId: string,
  newGptRequests: LLMLogObject | undefined,
  dbClients: DbClients
) => Promise<void>
type WebhookConfigurationHandler = (
  tenantId: string,
  oldWebhookConfiguration: WebhookConfiguration | undefined,
  newWebhookConfiguration: WebhookConfiguration | undefined,
  dbClients: DbClients
) => Promise<void>
type ConcurrentGroupBy = (update: DynamoDbEntityUpdate) => string

const sqsClient = getSQSClient()

@traceable
export class StreamConsumerBuilder {
  name: string
  fanOutSqsQueue: string
  secondaryFanOutSqsQueue: string
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
  crmRecordHandler?: CrmRecordHandler
  crmUserRecordLinkHandler?: CrmUserRecordLinkHandler
  alertsQaSamplingHandler?: AlertsQaSamplingHandler
  notificationsHandler?: NotificationsHandler
  llmRequestsHandler?: LLMRequestsHandler

  webhookConfigurationHandler?: WebhookConfigurationHandler
  constructor(
    name: string,
    fanOutSqsQueue: string,
    secondaryFanOutSqsQueue: string,
    getTableName: (tenantId: string) => string
  ) {
    this.name = name
    this.fanOutSqsQueue = fanOutSqsQueue
    this.secondaryFanOutSqsQueue = secondaryFanOutSqsQueue
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
  public setCrmRecordHandler(
    crmRecordHandler: CrmRecordHandler
  ): StreamConsumerBuilder {
    this.crmRecordHandler = crmRecordHandler
    return this
  }

  public setCrmUserRecordLinkHandler(
    crmUserRecordLinkHandler: CrmUserRecordLinkHandler
  ): StreamConsumerBuilder {
    this.crmUserRecordLinkHandler = crmUserRecordLinkHandler
    return this
  }

  public setAlertsQaSamplingHandler(
    alertsQaSamplingHandler: AlertsQaSamplingHandler
  ): StreamConsumerBuilder {
    this.alertsQaSamplingHandler = alertsQaSamplingHandler
    return this
  }

  public setNotificationsHandler(
    notificationsHandler: NotificationsHandler
  ): StreamConsumerBuilder {
    this.notificationsHandler = notificationsHandler
    return this
  }

  public setLLMRequestsHandler(
    llmRequestsHandler: LLMRequestsHandler
  ): StreamConsumerBuilder {
    this.llmRequestsHandler = llmRequestsHandler
    return this
  }

  public setWebhookConfigurationHandler(
    webhookConfigurationHandler: WebhookConfigurationHandler
  ): StreamConsumerBuilder {
    this.webhookConfigurationHandler = webhookConfigurationHandler
    return this
  }

  public async handleDynamoDbUpdates(
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
          const acquireLockSubSegment = await addNewSubsegment(
            'StreamConsumer',
            `handleDynamoDbUpdates lock ${update.entityId} ${update.type}`
          )
          const shouldLock =
            envIsNot('test', 'local') &&
            update.type &&
            !LOCK_FREE_ENTITIES.includes(update.type)

          if (shouldLock && update.entityId) {
            await acquireLock(dbClients.dynamoDb, update.entityId, {
              startingDelay: 100,
              maxDelay: 5000,
            })
          }
          try {
            await this.handleDynamoDbUpdate(update, dbClients)
          } finally {
            if (shouldLock && update.entityId) {
              await releaseLock(dbClients.dynamoDb, update.entityId)
            }
          }
          acquireLockSubSegment?.close()
        }
        await this.handleDynamoDbUpdateGroup(groupUpdates, dbClients)
      })
    )
  }

  public async handleDynamoDbUpdateGroup(
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
          compact(
            transactionUpdates.map((update) => update.OldImage) ?? []
          ) as TransactionWithRulesResult[],
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
        await this.usersHandler(
          userUpdates[0].tenantId,
          compact(
            userUpdates.map((update) => update.OldImage) ?? []
          ) as UserWithRulesResult[],
          users,
          dbClients
        )
      }
    }
  }

  public async handleDynamoDbUpdate(
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
    } else if (update.type === 'CRM_RECORD' && this.crmRecordHandler) {
      await this.crmRecordHandler(
        update.tenantId,
        update.NewImage as CRMRecord,
        dbClients
      )
    } else if (
      update.type === 'CRM_USER_RECORD_LINK' &&
      this.crmUserRecordLinkHandler
    ) {
      await this.crmUserRecordLinkHandler(
        update.tenantId,
        update.NewImage as CRMRecordLink,
        dbClients
      )
    } else if (
      update.type === 'ALERTS_QA_SAMPLING' &&
      this.alertsQaSamplingHandler
    ) {
      await this.alertsQaSamplingHandler(
        update.tenantId,
        update.OldImage as AlertsQaSampling,
        update.NewImage as AlertsQaSampling,
        dbClients
      )
    } else if (update.type === 'NOTIFICATION' && this.notificationsHandler) {
      await this.notificationsHandler(
        update.tenantId,
        update.OldImage as Notification,
        update.NewImage as Notification,
        dbClients
      )
    } else if (update.type === 'GPT_REQUESTS' && this.llmRequestsHandler) {
      await this.llmRequestsHandler(
        update.tenantId,
        update.NewImage as LLMLogObject,
        dbClients
      )
    } else if (
      update.type === 'WEBHOOK_CONFIGURATION' &&
      this.webhookConfigurationHandler
    ) {
      await this.webhookConfigurationHandler(
        update.tenantId,
        update.OldImage as WebhookConfiguration,
        update.NewImage as WebhookConfiguration,
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
      const dynamoDb = getDynamoDbClient()
      const secondaryQueueTenants =
        await TenantService.getSecondaryQueueTenants(dynamoDb)

      await Promise.all(
        Object.entries(groups).map(async (entry) => {
          const tenantId = entry[0]
          const tenantUpdates = entry[1]

          if (
            secondaryQueueTenants.includes(tenantId) &&
            process.env.AWS_LAMBDA_FUNCTION_NAME !==
              StackConstants.SECONDARY_TARPON_QUEUE_CONSUMER_FUNCTION_NAME
          ) {
            const entries = tenantUpdates.map((update) => ({
              MessageBody: JSON.stringify(update),
            }))

            await backOff(
              () =>
                bulkSendMessages(
                  sqsClient,
                  this.secondaryFanOutSqsQueue,
                  entries
                ),
              { numOfAttempts: 10, startingDelay: 1000, maxDelay: 30000 }
            )

            return
          }

          await this.handleSqsDynamoUpdates(tenantId, tenantUpdates, dynamoDb)
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
    updates: DynamoDbEntityUpdate[],
    dynamoDb: DynamoDBDocumentClient
  ) {
    await withContext(async () => {
      const dbClients: DbClients = {
        dynamoDb,
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
      await initializeTenantContext(tenantId)
      const filteredUpdates = updates.filter(Boolean)
      const dynamoDb = getDynamoDbClient()
      if (tenantId !== '4c9cdf0251') {
        // Temporary fix to ease the number of mongo connections
        const dbClients = {
          dynamoDb,
          mongoDb: await getMongoDbClient(),
        }

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
                tableName,
                dbClients.mongoDb
              )
            }
          })
        )

        if (envIs('local', 'test')) {
          await this.handleDynamoDbUpdates(filteredUpdates, dbClients)
          return
        }
      }

      const secondaryQueueTenants =
        await TenantService.getSecondaryQueueTenants(dynamoDb)

      const entries = filteredUpdates
        .filter((update) => update.type && !update.NewImage?.ttl)
        .map((update) => ({
          MessageBody: JSON.stringify(update),
          tenantId,
        }))

      const primaryQueueEntries = entries.filter(
        (entry) => !secondaryQueueTenants.includes(entry.tenantId)
      )

      const secondaryQueueEntries = entries.filter((entry) =>
        secondaryQueueTenants.includes(entry.tenantId)
      )

      await Promise.all([
        bulkSendMessages(sqsClient, this.fanOutSqsQueue, primaryQueueEntries),
        backOff(
          () =>
            bulkSendMessages(
              sqsClient,
              this.secondaryFanOutSqsQueue,
              secondaryQueueEntries
            ),
          { numOfAttempts: 10, startingDelay: 1000, maxDelay: 30000 }
        ),
      ])
    })
  }
}
