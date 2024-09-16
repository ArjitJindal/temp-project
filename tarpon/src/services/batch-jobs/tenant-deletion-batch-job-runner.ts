import {
  DeleteObjectsCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { memoize, orderBy } from 'lodash'
import { DeleteCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import {
  getAllUsagePlans,
  getTenantIdFromUsagePlanName,
} from '@flagright/lib/tenants/usage-plans'
import {
  APIGatewayClient,
  GetUsagePlanKeysCommand,
  UpdateApiKeyCommand,
} from '@aws-sdk/client-api-gateway'
import { MongoClient } from 'mongodb'
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
import { getDynamoDbClient, paginateQueryGenerator } from '@/utils/dynamodb'
import { DynamoDbKeyEnum, DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { ListHeader } from '@/@types/openapi-internal/ListHeader'
import { traceable } from '@/core/xray'
import { getAuth0ManagementClient } from '@/utils/auth0-utils'
import { getContext } from '@/core/utils/context'
import {
  TENANT_DELETION_COLLECTION,
  DYNAMODB_PARTITIONKEYS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { envIs, envIsNot } from '@/utils/env'
import dayjs from '@/utils/dayjs'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { DeleteTenantStatusEnum } from '@/@types/openapi-internal/DeleteTenantStatusEnum'
import { DeleteTenantStatus } from '@/@types/openapi-internal/DeleteTenantStatus'

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
  // TO IMPLEMENT
  | 'V8_LOGIC_USER_TIME_AGGREGATION'
  | 'V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER'
  | 'V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER'
> // If new Dynamo Key is added then it will be type checked so that it must have a way to delete if created

@traceable
export class TenantDeletionBatchJobRunner extends BatchJobRunner {
  private dynamoDb = memoize(() => getDynamoDbClient())
  private mongoDb = memoize(async () => await getMongoDbClient())
  private deletedUserAggregationUserIds = new Set<string>()
  private auth0Domain: string
  private accountsService = memoize(
    (auth0Domain: string, mongoDb: MongoClient) =>
      new AccountsService({ auth0Domain }, { mongoDb })
  )
  private managementClient = memoize((auth0Domain: string) =>
    getAuth0ManagementClient(auth0Domain)
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
    const allUsagePlans = await getAllUsagePlans(
      envIs('local') ? 'eu-central-1' : (process.env.AWS_REGION as string)
    )

    const usagePlan = allUsagePlans.find(
      (usagePlan) =>
        getTenantIdFromUsagePlanName(usagePlan.name as string) === tenantId
    )

    if (!usagePlan) {
      logger.warn(`Usage plan not found for tenant ${tenantId}`)
      return
    }

    const apigateway = new APIGatewayClient({
      region: process.env.AWS_REGION,
      maxAttempts: 10,
    })

    const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
      usagePlanId: usagePlan.id,
    })

    const usagePlanKeys = await apigateway.send(usagePlanKeysCommand)

    if (!usagePlanKeys.items?.length) {
      logger.warn(`Usage plan ${usagePlan.id} does not have any keys`)
      return
    }

    for (const key of usagePlanKeys.items) {
      await apigateway.send(
        new UpdateApiKeyCommand({
          apiKey: key.id,
          patchOperations: [
            { op: 'replace', path: '/enabled', value: 'false' },
          ],
        })
      )
    }
  }

  private async deactivateAuth0Users(tenantId: string) {
    const mongoDb = await getMongoDbClient()
    const accountsService = this.accountsService(this.auth0Domain, mongoDb)
    logger.info('Deactivating all users from Auth0')
    const tenant = await accountsService.getTenantById(tenantId)
    if (!tenant) {
      logger.warn(`Tenant not found.`)
      return
    }
    const users = await accountsService.getTenantAccounts(tenant)
    for (const user of users) {
      logger.info(`Deactivating auth0 user ${user.id}`)
      await accountsService.deactivateAccount(tenantId, user.id)
    }
  }

  private async deleteDynamoDbData(tenantId: string) {
    const changeDate = dayjs('2024-01-30')
    const mongoDb = await this.mongoDb()
    const accountsService = this.accountsService(this.auth0Domain, mongoDb)

    try {
      const tenant = await this.getTenantByTenantId(tenantId, accountsService)
      const account = await accountsService.getOrganization(
        tenant?.name as string
      )
      /** If the tenant is created after https://github.com/flagright/orca/pull/3077#event-11574061803  */
      if (
        account?.metadata?.tenantCreatedAt &&
        dayjs(parseInt(account?.metadata?.tenantCreatedAt)).isAfter(changeDate)
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

  private async deleteListDeleted(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.LIST_DELETED(tenantId).PartitionKeyID

    await this.deleteLists(tenantId, partitionKeyId)
  }

  private async deleteListItem(tenantId: string, listId: string) {
    await this.deletePartition(
      tenantId,
      DynamoDbKeys.LIST_ITEM(tenantId, listId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      'list item'
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
      partitionKeyId,
      tableName,
      'List Header'
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
          DynamoDbKeys.RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION(
            tenantId,
            ruleInstance.id as string
          ).PartitionKeyID,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          'Rule Instance Time Aggregation'
        )
      }
    )
  }

  private async deleteRuleInstances(tenantId: string) {
    const tableName = StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
    const partitionKeyId = DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID

    await this.deletePartition(
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
    await this.deletePartition(
      tenantId,
      DynamoDbKeys.USER_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      'user aggregation'
    )
    await this.deletePartition(
      tenantId,
      DynamoDbKeys.USER_TIME_AGGREGATION(tenantId, userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      'user aggregation (time)'
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
      partitionKeyId,
      tableName,
      'Transaction Event'
    )
  }

  private async deleteARSScores(tenantId: string, transactionId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKey = DynamoDbKeys.ARS_VALUE_ITEM(
      tenantId,
      transactionId,
      '1'
    )

    await this.deletePartitionKey(partitionKey, tableName)
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
        key,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME
      )
    }
  }

  private async deleteUser(tenantId: string, user: UserWithRulesResult) {
    await this.deleteUserAggregation(tenantId, user.userId)
    await this.deletePartition(
      tenantId,
      DynamoDbKeys.BUSINESS_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      'business user event'
    )
    await this.deletePartition(
      tenantId,
      DynamoDbKeys.CONSUMER_USER_EVENT(tenantId, user.userId).PartitionKeyID,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      'consumer user event'
    )
    await this.deletePartitionKey(
      DynamoDbKeys.DRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartitionKey(
      DynamoDbKeys.KRS_VALUE_ITEM(tenantId, user.userId, '1'),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.deletePartitionKey(
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
    const mongoDb = await this.mongoDb()

    const accountsService = this.accountsService(this.auth0Domain, mongoDb)
    logger.info('Deleting all users from Auth0')
    const tenant = await this.getTenantByTenantId(tenantId, accountsService)
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
      partitionKeyId,
      tableName,
      'Risk Classification'
    )
  }

  private async deleteRiskParameters(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKeyId =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      partitionKeyId,
      tableName,
      'Risk RiskParameters'
    )
  }

  private async deleteRiskParametersV8(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKeyId =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      partitionKeyId,
      tableName,
      'Risk RiskParameters'
    )
  }

  private async deleteRiskFactors(tenantId: string) {
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
    const partitionKeyId = DynamoDbKeys.RISK_FACTOR(tenantId).PartitionKeyID

    await this.deletePartition(
      tenantId,
      partitionKeyId,
      tableName,
      'Risk Factor'
    )
  }

  private async deleteTenantSettings(tenantId: string) {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME
    const partitionKey = DynamoDbKeys.TENANT_SETTINGS(tenantId)

    await this.deletePartitionKey(partitionKey, tableName)
  }

  private async deletePartitionKey(key: DynamoDbKey, tableName: string) {
    const deleteCommand = new DeleteCommand({ TableName: tableName, Key: key })
    await this.dynamoDb().send(deleteCommand)
  }

  private async deletePartition(
    tenantId: string,
    partitionKeyId: string,
    tableName: string,
    entityName?: string
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
        await this.deletePartitionKey(item, tableName)
      }
    )
    logger.info(
      `Deleted  ${partitionKeyId}` + (entityName ? ` ${entityName}` : '')
    )
  }
  private async deleteAuth0Organization(tenantId: string) {
    const mongoDb = await this.mongoDb()
    const accountsService = this.accountsService(this.auth0Domain, mongoDb)
    const tenant = await this.getTenantByTenantId(tenantId, accountsService)
    if (tenant == null) {
      logger.warn(`Tenant ${tenantId} not found`)
      return
    }
    const managementClient = await this.managementClient(this.auth0Domain)
    await managementClient.organizations.delete({ id: tenant.orgId })
  }

  private async deleteDynamoDbDataUsingMongo(tenantId: string) {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()

    const collection = db.collection(
      DYNAMODB_PARTITIONKEYS_COLLECTION(tenantId)
    )
    const cursor = collection.find()
    for await (const doc of cursor) {
      await this.deletePartition(tenantId, doc._id.toString(), doc.TableName)
      await collection.deleteOne({ _id: doc._id })
    }
  }
}
