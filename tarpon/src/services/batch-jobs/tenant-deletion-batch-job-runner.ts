import {
  DeleteObjectsCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { memoize, orderBy } from 'lodash'
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { AccountsService } from '../accounts'
import {
  getNonUserReceiverKeys,
  getNonUserSenderKeys,
  getReceiverKeys,
  getSenderKeys,
  getUserReceiverKeys,
  getUserSenderKeys,
} from '../rules-engine/utils'
import {
  executeClickhouseDefaultClientQuery,
  getClickhouseClient,
  getClickhouseDbName,
} from '../../utils/clickhouse/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { TenantDeletionBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { allCollections, getMongoDbClient } from '@/utils/mongodb-utils'
import {
  dangerouslyDeletePartition,
  dangerouslyDeletePartitionKey,
  dangerouslyQueryPaginateDelete,
  getDynamoDbClient,
} from '@/utils/dynamodb'
import { DynamoDbKeyEnum, DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { ListHeader } from '@/@types/openapi-internal/ListHeader'
import { traceable } from '@/core/xray'
import { getContext } from '@/core/utils/context-storage'
import {
  TENANT_DELETION_COLLECTION,
  DYNAMODB_PARTITIONKEYS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { envIsNot } from '@/utils/env'
import dayjs from '@/utils/dayjs'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { DeleteTenantStatusEnum } from '@/@types/openapi-internal/DeleteTenantStatusEnum'
import { DeleteTenantStatus } from '@/@types/openapi-internal/DeleteTenantStatus'
import { Alert } from '@/@types/openapi-internal/Alert'
import { CRM_MODEL_TYPES } from '@/@types/openapi-internal-custom/CRMModelType'
import { toggleApiKeys } from '@/utils/api-usage'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
})

type DynamoDbKey = {
  PartitionKeyID: string
  SortKeyID: string
}

type ExcludedDynamoDbKey = Exclude<
  DynamoDbKeyEnum,
  | 'ALL_TRANSACTION'
  | 'ARS_VALUE_ITEM'
  | 'KRS_VALUE_ITEM'
  | 'DRS_VALUE_ITEM'
  | 'AVG_ARS_VALUE_ITEM'
  | 'USER_TRANSACTION'
  | 'NON_USER_TRANSACTION'
  | 'BUSINESS_USER_EVENT'
  | 'CONSUMER_USER_EVENT'
  | 'DESTINATION_IP_ADDRESS_TRANSACTION'
  | 'ORIGIN_IP_ADDRESS_TRANSACTION'
  | 'LIST_ITEM'
  | 'CURRENCY_CACHE'
  | 'RULE'
  | 'RULE_USER_TIME_AGGREGATION'
  | 'USER_TIME_AGGREGATION'
  | 'USER_AGGREGATION'
  | 'RULE_USER_TIME_AGGREGATION_MARKER'
  | 'TRANSACTION_EVENT'
  | 'CACHE_QUESTION_RESULT'
  | 'IP_ADDRESS_CACHE'
  | 'SHARED_LOCKS'
  // TO IMPLEMENT
  | 'V8_LOGIC_USER_TIME_AGGREGATION'
  | 'V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER'
  | 'V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER'
  | 'AVG_ARS_VALUE_ITEM'
  | 'AVG_ARS_READY_MARKER'
  | 'ACTIVE_SESSIONS'
  | 'ALERT_COMMENT'
  | 'ALERT_COMMENT_FILE'
  // TODO to implement
  | 'ORGANIZATION'
  | 'ORGANIZATION_ACCOUNTS'
  | 'ACCOUNTS'
  | 'ACCOUNTS_BY_EMAIL'
  | 'ROLES'
  | 'ROLES_BY_NAME'
  | 'ROLES_BY_NAMESPACE'
  | 'RULE_INSTANCE_THRESHOLD_OPTIMIZATION_DATA'
  | 'CRM_USER_RECORD_LINK'
  | 'CASE'
  | 'CASE_ALERT'
  | 'CASE_COMMENT'
  | 'CASE_COMMENT_FILE'
  | 'CASE_SUBJECT'
  | 'WORKFLOWS'
  | 'COUNTER'
  | 'ALERTS_QA_SAMPLING'
  | 'BATCH_TRANSACTION'
  | 'BATCH_TRANSACTION_EVENT'
  | 'BATCH_CONSUMER_USER'
  | 'BATCH_CONSUMER_USER_EVENT'
  | 'BATCH_BUSINESS_USER'
  | 'BATCH_BUSINESS_USER_EVENT'
  | 'CASE_TRANSACTION_IDS'
  | 'GPT_REQUESTS'
> // If new Dynamo Key is added then it will be type checked so that it must have a way to delete if created

@traceable
export class TenantDeletionBatchJobRunner extends BatchJobRunner {
  private dynamoDb = memoize(() => getDynamoDbClient())
  private mongoDb = memoize(async () => await getMongoDbClient())
  private deletedUserAggregationUserIds = new Set<string>()
  private auth0Domain: string
  private accountsService = memoize(
    (auth0Domain: string) =>
      new AccountsService({ auth0Domain }, { dynamoDb: this.dynamoDb() })
  )
  constructor(jobId: string) {
    super(jobId)
    const context = getContext()
    this.auth0Domain = context?.auth0Domain as string
  }

  private getTenantByTenantId = memoize(
    async (tenantId: string, accountsService: AccountsService) => {
      const tenant = await accountsService.getTenantById(tenantId)
      return tenant
    }
  )

  private async dropMongoTables(tenantId: string) {
    const mongoDb = await this.mongoDb()
    const db = mongoDb.db()

    const collections = await allCollections(tenantId, db)
    for (const collection of collections) {
      await db.collection(collection).drop()
      logger.info(`Dropped collection ${collection}`)
    }
  }

  protected async run(job: TenantDeletionBatchJob): Promise<void> {
    const { tenantId } = job

    logger.info(`Started deleting tenant ${tenantId}`)

    try {
      await this.addStatusRecord(tenantId, 'IN_PROGRESS')
      if (job.parameters.notRecoverable) {
        // No parallelism here because we want to make sure that all data is deleted before
        await Promise.all([
          this.deleteS3Data(tenantId),
          this.deleteDynamoDbData(tenantId),
        ])
        try {
          await this.deleteAuth0Users(tenantId)
          await this.deleteAuth0Organization(tenantId)
        } catch (e) {
          logger.error(`Failed to delete Auth0 users and organization - ${e}`)
          await this.addStatusRecord(tenantId, 'FAILED', (e as Error).message)
        }
        try {
          await this.dropMongoTables(tenantId)
          await this.nukeClickhouseTables(tenantId)
          await this.nukeClickhouseTables(`${tenantId}-test`)
        } catch (e) {
          logger.error(`Failed to delete mongo tables - ${e}`)
          await this.addStatusRecord(tenantId, 'FAILED', (e as Error).message)
        }
        await this.addStatusRecord(tenantId, 'HARD_DELETED')
      } else {
        await Promise.all([
          this.deactivateAuth0Users(tenantId),
          this.deactivateApiKeys(tenantId),
        ])

        await this.addStatusRecord(tenantId, 'WAITING_HARD_DELETE')
      }
    } catch (e) {
      logger.error(`Failed to delete tenant ${tenantId} - ${e}`)
      await this.addStatusRecord(tenantId, 'FAILED', (e as Error).message)
      throw e
    }
  }

  private async findTenantRecord(tenantId: string) {
    const mongoDb = await this.mongoDb()
    const db = mongoDb.db()
    const collectionName = TENANT_DELETION_COLLECTION
    const collection = db.collection<DeleteTenant>(collectionName)

    return collection.findOne({ tenantId: tenantId })
  }

  private async addStatusRecord(
    tenantId: string,
    status: DeleteTenantStatusEnum,
    message?: string
  ) {
    const mongoDb = await this.mongoDb()
    const db = mongoDb.db()
    const collectionName = TENANT_DELETION_COLLECTION
    const collection = db.collection<DeleteTenant>(collectionName)

    const record = await this.findTenantRecord(tenantId)
    if (record) {
      const newStatus: DeleteTenantStatus = {
        status,
        timestamp: Date.now(),
        message,
      }

      await collection.updateOne(
        { tenantId },
        {
          $push: { statuses: newStatus },
          $set: { latestStatus: status, updatedTimestamp: Date.now() },
        }
      )

      return
    }

    throw new Error(`Tenant ${tenantId} record not found in tenant deletion`)
  }

  private async deactivateApiKeys(tenantId: string) {
    await toggleApiKeys(tenantId, false)
  }

  private async deactivateAuth0Users(tenantId: string) {
    const accountsService = this.accountsService(this.auth0Domain)
    logger.info('Deactivating all users from Auth0')
    const tenant = await accountsService.getTenantById(tenantId)
    if (!tenant) {
      logger.warn(`Tenant not found.`)
      return
    }
    const users = await accountsService.getTenantAccounts(tenant)
    for (const user of users) {
      logger.info(`Deactivating auth0 user ${user.id}`)
      await accountsService.blockAccount(tenantId, user.id, 'DELETED', true)
    }
  }

  private async deleteDynamoDbData(tenantId: string) {
    const changeDate = dayjs('2024-01-30')
    const accountsService = this.accountsService(this.auth0Domain)

    try {
      const tenant = await this.getTenantByTenantId(tenantId, accountsService)
      /** If the tenant is created after https://github.com/flagright/orca/pull/3077#event-11574061803  */
      if (
        tenant?.tenantCreatedAt &&
        dayjs(parseInt(tenant.tenantCreatedAt)).isAfter(changeDate)
      ) {
        await this.deleteDynamoDbDataUsingMongo(tenantId)
        return
      }
    } catch (e) {
      logger.error(`Failed to get Tenant Probably Tenant not found - ${e}`)
      await this.addStatusRecord(tenantId, 'FAILED', (e as Error).message)
    }

    const dynamoDbKeysToDelete: Record<
      ExcludedDynamoDbKey,
      {
        method: (tenantId: string) => Promise<void>
        order: number
      }
    > = {
      RISK_CLASSIFICATION: {
        method: this.deleteRiskClassifications.bind(this),
        order: 1,
      },
      PARAMETER_RISK_SCORES_DETAILS: {
        method: this.deleteRiskParameters.bind(this),
        order: 2,
      },
      PARAMETER_RISK_SCORES_DETAILS_V8: {
        method: this.deleteRiskParametersV8.bind(this),
        order: 3,
      },
      RISK_FACTOR: {
        method: this.deleteRiskFactors.bind(this),
        order: 4,
      },
      TRANSACTION: {
        method: this.deleteTransactions.bind(this),
        order: 5,
      },
      USER: {
        method: this.deleteUsers.bind(this),
        order: 6,
      },
      RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION: {
        method: this.deleteRuleInstanceTimeAggregation.bind(this),
        order: 7,
      },
      RULE_INSTANCE: {
        method: this.deleteRuleInstances.bind(this),
        order: 8,
      },
      LIST_HEADER: {
        method: this.deleteListHeaders.bind(this),
        order: 9,
      },
      LIST_DELETED: {
        method: this.deleteListDeleted.bind(this),
        order: 10,
      },
      TENANT_SETTINGS: {
        method: this.deleteTenantSettings.bind(this),
        order: 11,
      },
      AGGREGATION_VARIABLE: {
        method: this.deleteAggregationVariables.bind(this),
        order: 12,
      },
      SLACK_ALERTS_TIMESTAMP_MARKER: {
        method: this.deleteSlackAlertsMarker.bind(this),
        order: 13,
      },
      SAR_ITEMS: {
        method: this.deleteSarItems.bind(this),
        order: 14,
      },
      ALERT: {
        method: this.deleteAlertsData.bind(this),
        order: 15,
      },
      CRM_RECORD: {
        method: this.deleteCrmRecords.bind(this),
        order: 16,
      },
      SEARCH_PROFILE: {
        method: this.deleteSearchProfiles.bind(this),
        order: 17,
      },
      SCREENING_PROFILE: {
        method: this.deleteScreeningProfiles.bind(this),
        order: 18,
      },
      DEFAULT_FILTERS: {
        method: this.deleteDefaultFilters.bind(this),
        order: 19,
      },
      NOTIFICATIONS: {
        method: this.deleteNotifications.bind(this),
        order: 20,
      },
      AUDIT_LOGS: {
        method: this.deleteAuditLogs.bind(this),
        order: 21,
      },
      JOBS: {
        method: this.deleteBatchJobs.bind(this),
        order: 22,
      },
      REASONS: {
        method: this.deleteReasons.bind(this),
        order: 22,
      },
    }

    const dynamoDbKeysToDeleteArray = orderBy(
      Object.values(dynamoDbKeysToDelete),
      (key) => key.order,
      'asc'
    )

    for (const key of dynamoDbKeysToDeleteArray) {
      await key.method(tenantId)
    }
  }

  private async deleteCrmRecords(tenantId: string) {
    for (const model of CRM_MODEL_TYPES) {
      await dangerouslyDeletePartition(
        this.dynamoDb(),
        tenantId,
        DynamoDbKeys.CRM_RECORD(tenantId, model, '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'CRM Record'
      )
    }
  }

  private async deleteAggregationVariables(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.AGGREGATION_VARIABLE(
      tenantId,
      ''
    ).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'Aggregation Variable'
    )
  }

  private async deleteAlertsData(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.ALERT(tenantId, '').PartitionKeyID
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
    }

    await dangerouslyQueryPaginateDelete<Alert>(
      this.dynamoDb(),
      tenantId,
      queryInput,
      (tenantId, alert) => {
        return this.deleteAlert(tenantId, alert)
      }
    )
  }

  private async deleteAlert(tenantId: string, alert: Alert) {
    const alertId = alert.alertId as string

    await Promise.all([
      dangerouslyDeletePartition(
        this.dynamoDb(),
        tenantId,
        DynamoDbKeys.ALERT_COMMENT(tenantId, alertId, '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Alert Comment'
      ),
      dangerouslyDeletePartition(
        this.dynamoDb(),
        tenantId,
        DynamoDbKeys.ALERT_COMMENT_FILE(tenantId, alertId, '', '')
          .PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Alert Comment File'
      ),
      dangerouslyDeletePartitionKey(
        this.dynamoDb(),
        DynamoDbKeys.ALERT(tenantId, alertId),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      ),
    ])
  }

  private async deleteListHeaders(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.LIST_HEADER(tenantId).PartitionKeyID

    await this.deleteLists(tenantId, partitionKeyId)
  }

  private async nukeClickhouseTables(tenantId: string) {
    if (envIsNot('dev')) {
      return
    }

    const result = await executeClickhouseDefaultClientQuery(async (client) => {
      const queryResult = await client.query({
        query: `SHOW DATABASES`,
        format: 'JSONEachRow',
      })

      const databases = await queryResult.json<{ name: string }>()

      if (!databases.some((db) => db.name === getClickhouseDbName(tenantId))) {
        return false
      }
    })

    if (!result) {
      return
    }

    const client = await getClickhouseClient(tenantId)
    await client.query({
      query: `DROP DATABASE ${getClickhouseDbName(tenantId)}`,
    })
  }

  private async deleteSarItems(tenantId: string) {
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.SAR_ITEMS(tenantId, '').PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'SAR Items'
    )
  }

  private async deleteListDeleted(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.LIST_DELETED(tenantId).PartitionKeyID

    await this.deleteLists(tenantId, partitionKeyId)
  }

  private async deleteListItem(
    tenantId: string,
    listId: string,
    version: number
  ) {
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.LIST_ITEM(tenantId, listId, version).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'list item'
    )
  }

  private async deleteLists(tenantId: string, partitionKeyId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const allListHeadersQueryInput: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
    }

    await dangerouslyQueryPaginateDelete<ListHeader>(
      this.dynamoDb(),
      tenantId,
      allListHeadersQueryInput,
      (tenantId, listHeader) => {
        return this.deleteListItem(
          tenantId,
          listHeader.listId as string,
          listHeader.version as number
        )
      }
    )

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'List Header'
    )
  }

  private async deleteRuleInstanceTimeAggregation(tenantId: string) {
    const allRuleInstancesQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID,
      },
    }

    await dangerouslyQueryPaginateDelete<RuleInstance>(
      this.dynamoDb(),
      tenantId,
      allRuleInstancesQueryInput,
      async (tenantId, ruleInstance) => {
        // TODO: Delete RULE_USER_TIME_AGGREGATION_MARKER
        await dangerouslyDeletePartition(
          this.dynamoDb(),
          tenantId,
          DynamoDbKeys.RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION(
            tenantId,
            ruleInstance.id as string
          ).PartitionKeyID,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          'Rule Instance Time Aggregation'
        )
      }
    )
  }

  private async deleteRuleInstances(tenantId: string) {
    const tableName = StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
    const partitionKeyId = DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Rule Instance'
    )
  }

  private async deleteUserAggregation(tenantId: string, userId?: string) {
    if (!userId || this.deletedUserAggregationUserIds.has(userId)) {
      return
    }
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.USER_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'user aggregation'
    )
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.USER_TIME_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'user aggregation (time)'
    )

    this.deletedUserAggregationUserIds.add(userId)
  }

  private async deleteTransactionEvents(
    tenantId: string,
    transactionId: string
  ) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.TRANSACTION_EVENT(
      tenantId,
      transactionId
    ).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Transaction Event'
    )
  }

  private async deleteARSScores(tenantId: string, transactionId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKey = DynamoDbKeys.ARS_VALUE_ITEM(
      tenantId,
      transactionId,
      '1'
    )

    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      partitionKey,
      tableName
    )
  }

  private async deleteTransactionIndices(
    tenantId: string,
    transaction: TransactionWithRulesResult
  ) {
    const destinationIpAddress = transaction.destinationDeviceData?.ipAddress
    const originIpAddress = transaction.originDeviceData?.ipAddress
    const { timestamp, type, transactionId } = transaction
    const keysToDelete = [
      getSenderKeys(tenantId, transaction),
      getSenderKeys(tenantId, transaction, type),
      getUserSenderKeys(tenantId, transaction),
      getUserSenderKeys(tenantId, transaction, type),
      getNonUserSenderKeys(tenantId, transaction),
      getNonUserSenderKeys(tenantId, transaction, type),
      getReceiverKeys(tenantId, transaction),
      getReceiverKeys(tenantId, transaction, type),
      getUserReceiverKeys(tenantId, transaction),
      getUserReceiverKeys(tenantId, transaction, type),
      getNonUserReceiverKeys(tenantId, transaction),
      getNonUserReceiverKeys(tenantId, transaction, type),
      originIpAddress &&
        DynamoDbKeys.ORIGIN_IP_ADDRESS_TRANSACTION(tenantId, originIpAddress, {
          timestamp,
          transactionId,
        }),
      destinationIpAddress &&
        DynamoDbKeys.DESTINATION_IP_ADDRESS_TRANSACTION(
          tenantId,
          destinationIpAddress,
          { timestamp, transactionId }
        ),
      // Always delete the primary transaction item at last to avoid having zombie indexes that
      // can not be deleted.
      DynamoDbKeys.TRANSACTION(tenantId, transactionId),
    ].filter(Boolean) as Array<DynamoDbKey>

    for (const key of keysToDelete) {
      await dangerouslyDeletePartitionKey(
        this.dynamoDb(),
        key,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      )
    }
  }

  private async deleteUser(tenantId: string, user: UserWithRulesResult) {
    await this.deleteUserAggregation(tenantId, user.userId)
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.BUSINESS_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'business user event'
    )
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      DynamoDbKeys.CONSUMER_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      'consumer user event'
    )
    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      DynamoDbKeys.DRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    )
    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      DynamoDbKeys.KRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    )
    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      DynamoDbKeys.USER(tenantId, user.userId) as DynamoDbKey,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    )
  }

  private async deleteUsers(tenantId: string) {
    const usersQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER(tenantId).PartitionKeyID,
      },
    }

    await dangerouslyQueryPaginateDelete<UserWithRulesResult>(
      this.dynamoDb(),
      tenantId,
      usersQueryInput,
      (tenantId, user) => {
        return this.deleteUser(tenantId, user)
      }
    )
  }

  private async deleteTransaction(
    tenantId: string,
    transaction: TransactionWithRulesResult
  ) {
    const { originUserId, destinationUserId, transactionId } = transaction
    await this.deleteUserAggregation(tenantId, originUserId)
    await this.deleteUserAggregation(tenantId, destinationUserId)
    await this.deleteTransactionEvents(tenantId, transactionId)
    await this.deleteARSScores(tenantId, transactionId)
    await this.deleteTransactionIndices(tenantId, transaction)
  }

  private async deleteTransactions(tenantId: string) {
    const transactionsQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.TRANSACTION(tenantId).PartitionKeyID,
      },
    }

    await dangerouslyQueryPaginateDelete<TransactionWithRulesResult>(
      this.dynamoDb(),
      tenantId,
      transactionsQueryInput,
      (tenantId, transaction) => {
        return this.deleteTransaction(tenantId, transaction)
      }
    )
  }

  private async deleteS3Data(tenantId: string) {
    const { IMPORT_BUCKET, TMP_BUCKET, DOCUMENT_BUCKET } = process.env

    await this.deleteS3Directory(tenantId, IMPORT_BUCKET as string)
    await this.deleteS3Directory(tenantId, TMP_BUCKET as string)
    await this.deleteS3Directory(tenantId, DOCUMENT_BUCKET as string)
  }

  private async deleteS3Directory(tenantId: string, bucket: string) {
    let marker: string | undefined

    do {
      const response = await s3Client.send(
        new ListObjectsCommand({
          Bucket: bucket,
          Prefix: `${tenantId}/`,
          MaxKeys: 1000,
          Marker: marker,
        })
      )

      const objects = response.Contents?.map((content) => ({
        Key: content.Key,
      }))

      logger.info(`Deleting ${objects?.length} files.`)

      if (!objects?.length) {
        return
      }

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects },
        })
      )

      marker = response.NextMarker

      logger.info(`Deleted ${objects?.length} files.`)
    } while (marker)

    logger.info(`Deleted S3 files.`)
  }

  private async deleteAuth0Users(tenantId: string) {
    const accountsService = this.accountsService(this.auth0Domain)
    logger.info('Deleting all users from Auth0')
    const tenant = await this.getTenantByTenantId(tenantId, accountsService)
    if (!tenant) {
      logger.warn(`Tenant not found.`)
      return
    }
    const users = await accountsService.auth0.getTenantAccounts(tenant)
    for (const user of users) {
      logger.info(`Deleting auth0 user ${user.id}`)
      await accountsService.deleteAuth0User(user)
    }
  }

  private async deleteRiskClassifications(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId =
      DynamoDbKeys.RISK_CLASSIFICATION(tenantId).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Risk Classification'
    )
  }

  private async deleteSearchProfiles(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.SEARCH_PROFILE(tenantId).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Search Profile'
    )
  }

  private async deleteScreeningProfiles(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId =
      DynamoDbKeys.SCREENING_PROFILE(tenantId).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Screening Profile'
    )
  }

  private async deleteDefaultFilters(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.DEFAULT_FILTERS(tenantId).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Default Filters'
    )
  }

  private async deleteRiskParameters(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(tenantId).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Risk RiskParameters'
    )
  }

  private async deleteRiskParametersV8(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(tenantId).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Risk RiskParameters'
    )
  }

  private async deleteRiskFactors(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.RISK_FACTOR(tenantId).PartitionKeyID

    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Risk Factor'
    )
  }

  private async deleteTenantSettings(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKey = DynamoDbKeys.TENANT_SETTINGS(tenantId)

    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      partitionKey,
      tableName
    )
  }

  private async deleteSlackAlertsMarker(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)

    await dangerouslyDeletePartitionKey(
      this.dynamoDb(),
      DynamoDbKeys.SLACK_ALERTS_TIMESTAMP_MARKER(tenantId),
      tableName
    )
  }

  private async deleteAuth0Organization(tenantId: string) {
    const accountsService = this.accountsService(this.auth0Domain)
    const tenant = await this.getTenantByTenantId(tenantId, accountsService)
    if (tenant == null) {
      logger.warn(`Tenant ${tenantId} not found`)
      return
    }
    await accountsService.deleteOrganization(tenant)
  }

  private async deleteDynamoDbDataUsingMongo(tenantId: string) {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()

    const collection = db.collection(
      DYNAMODB_PARTITIONKEYS_COLLECTION(tenantId)
    )
    const cursor = collection.find()
    for await (const doc of cursor) {
      await dangerouslyDeletePartition(
        this.dynamoDb(),
        tenantId,
        doc._id.toString(),
        doc.TableName
      )
      await collection.deleteOne({ _id: doc._id })
    }
  }

  private async deleteNotifications(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.NOTIFICATIONS(
      tenantId,
      ''
    ).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Notification'
    )
  }

  private async deleteAuditLogs(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.AUDIT_LOGS(tenantId).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Audit Logs'
    )
  }

  private async deleteBatchJobs(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.JOBS(tenantId, '').PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Jobs'
    )
  }

  private async deleteReasons(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    const partitionKeyId = DynamoDbKeys.REASONS(
      tenantId,
      '',
      'ESCALATION' // Passing ReasonType to get PartitionKeyID
    ).PartitionKeyID
    await dangerouslyDeletePartition(
      this.dynamoDb(),
      tenantId,
      partitionKeyId,
      tableName,
      'Reasons'
    )
  }
}
