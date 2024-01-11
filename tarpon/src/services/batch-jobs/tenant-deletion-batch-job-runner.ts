import {
  DeleteObjectsCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { memoize, orderBy } from 'lodash'
import { DeleteCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
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
import { BatchJobRunner } from './batch-job-runner-base'
import { TenantDeletionBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient, paginateQueryGenerator } from '@/utils/dynamodb'
import { DynamoDbKeyEnum, DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { ListHeader } from '@/@types/openapi-internal/ListHeader'
import { traceable } from '@/core/xray'

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
  | 'USER_TRANSACTION'
  | 'NON_USER_TRANSACTION'
  | 'BUSINESS_USER_EVENT'
  | 'CONSUMER_USER_EVENT'
  | 'DESTINATION_IP_ADDRESS_TRANSACTION'
  | 'ORIGIN_IP_ADDRESS_TRANSACTION'
  | 'LIST_ITEM'
  | 'CURRENCY_CACHE'
  | 'RULE'
  | 'DEVICE_DATA_METRICS'
  | 'RULE_USER_TIME_AGGREGATION'
  | 'USER_TIME_AGGREGATION'
  | 'USER_AGGREGATION'
  | 'RULE_USER_TIME_AGGREGATION_MARKER'
  | 'TRANSACTION_EVENT'
  // TO IMPLEMENT
  | 'V8_RULE_USER_TIME_AGGREGATION'
  | 'V8_RULE_USER_TIME_AGGREGATION_READY_MARKER'
  | 'V8_RULE_USER_TIME_AGGREGATION_TX_MARKER'
> // If new Dynamo Key is added then it will be type checked so that it must have a way to delete if created

@traceable
export class TenantDeletionBatchJobRunner extends BatchJobRunner {
  private dynamoDb = memoize(() => getDynamoDbClient())
  private deletedUserAggregationUserIds = new Set<string>()

  protected async run(job: TenantDeletionBatchJob): Promise<void> {
    await Promise.all([
      this.deleteS3Data(job.tenantId),
      this.deleteDynamoDbData(job.tenantId),
      this.deleteAuth0Users(job.tenantId),
    ])
  }

  private async deleteDynamoDbData(tenantId: string) {
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
      TRANSACTION: {
        method: this.deleteTransactions.bind(this),
        order: 3,
      },
      USER: {
        method: this.deleteUsers.bind(this),
        order: 4,
      },
      RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION: {
        method: this.deleteRuleInstanceTimeAggregation.bind(this),
        order: 5,
      },
      RULE_INSTANCE: {
        method: this.deleteRuleInstances.bind(this),
        order: 6,
      },
      LIST_HEADER: {
        method: this.deleteListHeaders.bind(this),
        order: 7,
      },
      LIST_DELETED: {
        method: this.deleteListDeleted.bind(this),
        order: 8,
      },
      TENANT_SETTINGS: {
        method: this.deleteTenantSettings.bind(this),
        order: 9,
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

  private async deleteListHeaders(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.LIST_HEADER(tenantId).PartitionKeyID

    await this.deleteLists(tenantId, partitionKeyId)
  }

  private async deleteListDeleted(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.LIST_DELETED(tenantId).PartitionKeyID

    await this.deleteLists(tenantId, partitionKeyId)
  }

  private async deleteListItem(tenantId: string, listId: string) {
    await this.deletePartition(
      tenantId,
      'list item',
      DynamoDbKeys.LIST_ITEM(tenantId, listId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  private async deleteLists(tenantId: string, partitionKeyId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME
    const allListHeadersQueryInput: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
    }

    await this.queryPaginateDelete<ListHeader>(
      tenantId,
      allListHeadersQueryInput,
      (tenantId, listHeader) => {
        return this.deleteListItem(tenantId, listHeader.listId as string)
      }
    )

    await this.deletePartition(
      tenantId,
      'List Header',
      partitionKeyId,
      tableName
    )
  }

  private async queryPaginateDelete<T>(
    tenantId: string,
    queryInput: QueryCommandInput,
    deleteMethod: (tenantId: string, item: T) => Promise<void>
  ) {
    for await (const result of paginateQueryGenerator(
      this.dynamoDb(),
      queryInput
    )) {
      for (const item of (result.Items || []) as T[]) {
        try {
          await deleteMethod(tenantId, item)
        } catch (e) {
          logger.error(`Failed to delete item ${item} - ${e}`)
          throw e
        }
      }
    }
  }

  private async deleteRuleInstanceTimeAggregation(tenantId: string) {
    const allRuleInstancesQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID,
      },
    }

    await this.queryPaginateDelete<RuleInstance>(
      tenantId,
      allRuleInstancesQueryInput,
      async (tenantId, ruleInstance) => {
        // TODO: Delete RULE_USER_TIME_AGGREGATION_MARKER
        await this.deletePartition(
          tenantId,
          'Rule Instance Time Aggregation',
          DynamoDbKeys.RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION(
            tenantId,
            ruleInstance.id as string
          ).PartitionKeyID,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME
        )
      }
    )
  }

  private async deleteRuleInstances(tenantId: string) {
    const tableName = StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
    const partitionKeyId = DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      'Rule Instance',
      partitionKeyId,
      tableName
    )
  }

  private async deleteUserAggregation(tenantId: string, userId?: string) {
    if (!userId || this.deletedUserAggregationUserIds.has(userId)) {
      return
    }
    await this.deletePartition(
      tenantId,
      'user aggregation',
      DynamoDbKeys.USER_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartition(
      tenantId,
      'user aggregation (time)',
      DynamoDbKeys.USER_TIME_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )

    this.deletedUserAggregationUserIds.add(userId)
  }

  private async deleteTransactionEvents(
    tenantId: string,
    transactionId: string
  ) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME
    const partitionKeyId = DynamoDbKeys.TRANSACTION_EVENT(
      tenantId,
      transactionId
    ).PartitionKeyID

    await this.deletePartition(
      tenantId,
      'Transaction Event',
      partitionKeyId,
      tableName
    )
  }

  private async deleteARSScores(tenantId: string, transactionId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKey = DynamoDbKeys.ARS_VALUE_ITEM(
      tenantId,
      transactionId,
      '1'
    )

    await this.deletePartitionKey('AR Scores', partitionKey, tableName)
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
      await this.deletePartitionKey(
        'transaction',
        key,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME
      )
    }
  }

  private async deleteUser(tenantId: string, user: UserWithRulesResult) {
    await this.deleteUserAggregation(tenantId, user.userId)
    await this.deletePartition(
      tenantId,
      'business user event',
      DynamoDbKeys.BUSINESS_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartition(
      tenantId,
      'consumer user event',
      DynamoDbKeys.CONSUMER_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartitionKey(
      'drs value item',
      DynamoDbKeys.DRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartitionKey(
      'krs value item',
      DynamoDbKeys.KRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartition(
      tenantId,
      'device data metrics',
      DynamoDbKeys.DEVICE_DATA_METRICS(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartitionKey(
      'user',
      DynamoDbKeys.USER(tenantId, user.userId) as DynamoDbKey,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  private async deleteUsers(tenantId: string) {
    const usersQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER(tenantId).PartitionKeyID,
      },
    }

    await this.queryPaginateDelete<UserWithRulesResult>(
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
    // TODO: Delete RULE_USER_TIME_AGGREGATION for origin and destination user
    await this.deleteTransactionEvents(tenantId, transactionId)
    await this.deleteARSScores(tenantId, transactionId)
    await this.deleteTransactionIndices(tenantId, transaction)
  }

  private async deleteTransactions(tenantId: string) {
    const transactionsQueryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.TRANSACTION(tenantId).PartitionKeyID,
      },
    }

    await this.queryPaginateDelete<TransactionWithRulesResult>(
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

  private async deleteS3Directory(tenantId: string, directory: string) {
    let marker: string | undefined

    do {
      const response = await s3Client.send(
        new ListObjectsCommand({
          Bucket: process.env.DOCUMENT_BUCKET,
          Prefix: `${tenantId}/`,
          MaxKeys: 1000,
          Marker: marker,
        })
      )

      const objects = response.Contents?.map((content) => ({
        Key: content.Key,
      }))

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: directory,
          Delete: { Objects: objects },
        })
      )

      marker = response.NextMarker

      logger.info(`Deleted ${objects?.length} files.`)
    } while (marker)

    logger.info(`Deleted S3 files.`)
  }
  private async deleteAuth0Users(tenantId: string) {
    const mongoDb = await getMongoDbClient()
    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb }
    )
    logger.info('Deleting all users from Auth0')
    const tenant = await accountsService.getTenantById(tenantId)
    if (!tenant) {
      logger.warn(`Tenant not found.`)
      return
    }
    const users = await accountsService.getTenantAccounts(tenant)
    for (const user of users) {
      logger.info(`Deleting auth0 user ${user.id}`)
      await accountsService.deleteAuth0User(user.id)
    }
  }

  private async deleteRiskClassifications(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKeyId =
      DynamoDbKeys.RISK_CLASSIFICATION(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      'Risk Classification',
      partitionKeyId,
      tableName
    )
  }

  private async deleteRiskParameters(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKeyId =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      'Risk RiskParameters',
      partitionKeyId,
      tableName
    )
  }

  private async deleteTenantSettings(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME
    const partitionKey = DynamoDbKeys.TENANT_SETTINGS(tenantId)

    await this.deletePartitionKey('Tenant Settings', partitionKey, tableName)
  }

  private async deletePartitionKey(
    entityName: string,
    key: DynamoDbKey,
    tableName: string
  ) {
    const deleteCommand = new DeleteCommand({ TableName: tableName, Key: key })
    await this.dynamoDb().send(deleteCommand)

    logger.info(`Deleted ${entityName} ${JSON.stringify(key)}`)
  }

  private async deletePartition(
    tenantId: string,
    entityName: string,
    partitionKeyId: string,
    tableName: string
  ) {
    const queryInput: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
      ProjectionExpression: 'PartitionKeyID,SortKeyID',
    }

    await this.queryPaginateDelete<DynamoDbKey>(
      tenantId,
      queryInput,
      async (tenantId, item) => {
        await this.deletePartitionKey(entityName, item, tableName)
      }
    )
  }
}
