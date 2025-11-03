import { Filter, MongoClient, ReplaceOneModel } from 'mongodb'
import isNil from 'lodash/isNil'
import omitBy from 'lodash/omitBy'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { getDefaultProviders } from '../utils'
import { batchWrite } from '@/utils/dynamodb'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongo-table-names'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { traceable } from '@/core/xray'
import { cursorPaginate } from '@/utils/pagination'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/@types/pagination'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

const SUBJECT_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'entity',
  'paymentMethodId',
  'alertId',
] as const

const USER_ENTITY_FILTER_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'entity',
] as const

const OTHER_ENTITY_FILTER_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'entity',
  'paymentMethodId',
] as const

export type WhitelistSubject = Pick<
  SanctionsWhitelistEntity,
  (typeof SUBJECT_FIELDS)[number]
>

@traceable
export class SanctionsWhitelistEntityRepository {
  tenantId: string
  mongoDb?: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  private async getMongoDbClient() {
    return this.mongoDb ?? (await getMongoDbClient())
  }

  private async deleteFromDynamoDB(
    records: SanctionsWhitelistEntity[]
  ): Promise<void> {
    // Group records by their DynamoDB key and sanctionsEntity.id
    const groupedRecords = new Map<
      string,
      { hash: string; sanctionsEntityIds: Set<string> }
    >()

    for (const record of records) {
      const subject: WhitelistSubject = {
        userId: record.userId,
        entityType: record.entityType,
        searchTerm: record.searchTerm,
        entity: record.entity,
        paymentMethodId: record.paymentMethodId,
        alertId: record.alertId,
      }

      // Choose filter fields based on entity type
      const filterFields =
        subject.entity === 'USER'
          ? USER_ENTITY_FILTER_FIELDS
          : OTHER_ENTITY_FILTER_FIELDS

      const filterObject = filterFields.reduce(
        (acc, key) => ({
          ...acc,
          [key]: subject[key],
        }),
        {}
      )
      const filterWithProvider = { ...filterObject, provider: record.provider }
      const dynamoHash = generateChecksum(getSortedObject(filterWithProvider))

      const key = `${dynamoHash}`
      if (!groupedRecords.has(key)) {
        groupedRecords.set(key, {
          hash: dynamoHash,
          sanctionsEntityIds: new Set(),
        })
      }
      if (record.sanctionsEntity?.id) {
        const group = groupedRecords.get(key)
        if (group) {
          group.sanctionsEntityIds.add(record.sanctionsEntity.id)
        }
      }
    }

    // Process each group
    for (const { hash, sanctionsEntityIds } of groupedRecords.values()) {
      const key = DynamoDbKeys.SANCTIONS_WHITELIST_ENTITIES(this.tenantId, hash)
      const command = new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: key,
      })

      const result = await this.dynamoDb.send(command)
      const existingItems =
        (result.Item?.items as SanctionsWhitelistEntity[] | undefined) ?? []

      if (existingItems.length === 0) {
        continue
      }

      // Filter out items that should be removed
      const remainingItems = existingItems.filter(
        (item) => !sanctionsEntityIds.has(item.sanctionsEntity.id)
      )

      // If no items left, delete the entry, otherwise update it
      if (remainingItems.length === 0) {
        await batchWrite(
          this.dynamoDb,
          [
            {
              DeleteRequest: {
                Key: key,
              },
            },
          ],
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
        )
      } else {
        const putCommand = new PutCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          Item: {
            ...key,
            items: remainingItems,
          },
        })
        await this.dynamoDb.send(putCommand)
      }
    }
  }

  private async saveToDynamoDB(
    provider: SanctionsDataProviderName,
    subject: WhitelistSubject,
    newRecords: SanctionsWhitelistEntity[]
  ): Promise<void> {
    // Choose filter fields based on entity type
    const filterFields =
      subject.entity === 'USER'
        ? USER_ENTITY_FILTER_FIELDS
        : OTHER_ENTITY_FILTER_FIELDS

    const filterObject = filterFields.reduce(
      (acc, key) => ({
        ...acc,
        [key]: subject[key],
      }),
      {}
    )
    const filterWithProvider = { ...filterObject, provider }
    const dynamoHash = generateChecksum(getSortedObject(filterWithProvider))

    const key = DynamoDbKeys.SANCTIONS_WHITELIST_ENTITIES(
      this.tenantId,
      dynamoHash
    )
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })

    const result = await this.dynamoDb.send(command)
    const existingItems =
      (result.Item?.items as SanctionsWhitelistEntity[] | undefined) ?? []

    // Merge new records with existing ones, avoiding duplicates by sanctionsEntity.id
    const mergedItems = [...existingItems]
    for (const newRecord of newRecords) {
      const existingIndex = mergedItems.findIndex(
        (item) => item.sanctionsEntity.id === newRecord.sanctionsEntity.id
      )
      if (existingIndex !== -1) {
        mergedItems[existingIndex] = newRecord
      } else {
        mergedItems.push(newRecord)
      }
    }

    const putCommand = new PutCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...key,
        items: mergedItems,
      },
    })
    await this.dynamoDb.send(putCommand)
  }

  public async addWhitelistEntities(
    provider: SanctionsDataProviderName,
    entities: SanctionsEntity[],
    subject: WhitelistSubject,
    options?: {
      reason?: string[]
      comment?: string
      createdAt?: number
    }
  ): Promise<{
    newRecords: SanctionsWhitelistEntity[]
  }> {
    const mongodbClient = await this.getMongoDbClient()
    const collection = mongodbClient
      .db()
      .collection<SanctionsWhitelistEntity>(
        SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
      )
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: mongodbClient,
      dynamoDb: this.dynamoDb,
    })
    const ids = await counterRepository.getNextCountersAndUpdate(
      'SanctionsWhitelist',
      entities.length
    )

    const definedFields = omitBy(subject, isNil)

    const replaceOneUpdates: ReplaceOneModel<SanctionsWhitelistEntity>[] =
      entities.map((entity, i) => ({
        filter: {
          'sanctionsEntity.id': entity.id,
          ...definedFields,
        },
        replacement: {
          provider,
          sanctionsEntity: entity,
          sanctionsWhitelistId: `SW-${ids[i]}`,
          ...definedFields,
          createdAt: options?.createdAt ?? Date.now(),
          reason: options?.reason,
          comment: options?.comment,
        },
        upsert: true,
      }))

    await withTransaction(async () => {
      await collection.bulkWrite(
        replaceOneUpdates.map((update) => ({
          replaceOne: update,
        }))
      )
    })

    const newRecords = replaceOneUpdates.map((update) => ({
      ...update.replacement,
      sanctionsEntity: {
        entityType: update.replacement.sanctionsEntity.entityType,
        id: update.replacement.sanctionsEntity.id,
        name: update.replacement.sanctionsEntity.name,
      },
    }))
    await this.saveToDynamoDB(provider, subject, newRecords)
    return {
      newRecords,
    }
  }

  public async removeWhitelistEntities(
    sanctionsWhitelistIds: string[]
  ): Promise<void> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )

    // First, fetch the records to get provider and subject info
    // Only fetch fields needed for DynamoDB key computation
    const recordsToDelete = await collection
      .find(
        { sanctionsWhitelistId: { $in: sanctionsWhitelistIds } },
        {
          projection: {
            userId: 1,
            entityType: 1,
            searchTerm: 1,
            entity: 1,
            paymentMethodId: 1,
            alertId: 1,
            provider: 1,
            sanctionsEntity: 1,
          },
        }
      )
      .toArray()

    // Delete from DynamoDB in batches
    await this.deleteFromDynamoDB(recordsToDelete)

    // Delete from MongoDB
    await collection.deleteMany({
      sanctionsWhitelistId: { $in: sanctionsWhitelistIds },
    })
  }

  public async clear(): Promise<void> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    await collection.deleteMany({})
  }

  private async getBackfillStatus(): Promise<boolean> {
    const key = DynamoDbKeys.SANCTIONS_WHITELIST_BATCH_JOB_STATUS(this.tenantId)
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })
    const result = await this.dynamoDb.send(command)
    return result.Item?.isBackfillDone === true
  }

  public async getWhitelistEntities(
    requestEntityIds: string[],
    subject: WhitelistSubject,
    limit = Number.MAX_SAFE_INTEGER,
    providerOverride?: SanctionsDataProviderName
  ): Promise<SanctionsWhitelistEntity[]> {
    const provider = providerOverride ?? getDefaultProviders()?.[0]
    // Choose filter fields based on entity type
    const filterFields =
      subject.entity === 'USER'
        ? USER_ENTITY_FILTER_FIELDS
        : OTHER_ENTITY_FILTER_FIELDS

    const filterObject = filterFields.reduce(
      (acc, key) => ({
        ...acc,
        [key]: subject[key],
      }),
      {}
    )
    const filterWithProvider = { ...filterObject, provider }

    const dynamoHash = generateChecksum(getSortedObject(filterWithProvider))

    if (await this.getBackfillStatus()) {
      const key = DynamoDbKeys.SANCTIONS_WHITELIST_ENTITIES(
        this.tenantId,
        dynamoHash
      )
      const command = new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: key,
      })
      const result = await this.dynamoDb.send(command)
      const items =
        (result.Item?.items as SanctionsWhitelistEntity[] | undefined) ?? []
      return items.filter((item) =>
        requestEntityIds.includes(item.sanctionsEntity.id)
      )
    }
    const db = (await getMongoDbClient()).db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const filters = [
      // TODO change this after release.
      // https://github.com/flagright/orca/pull/4677
      {
        'sanctionsEntity.id': { $in: requestEntityIds },
      },
      {
        provider: provider,
      },
      ...filterFields.map((key) => ({
        $or: [{ [key]: subject[key] }],
      })),
    ]
    return collection.find({ $and: filters }).limit(limit).toArray()
  }

  public async matchWhitelistEntities(
    requestEntityIds: string[],
    subject: WhitelistSubject
  ): Promise<boolean> {
    const result = await this.getWhitelistEntities(requestEntityIds, subject, 1)
    return result.length > 0
  }

  public async searchWhitelistEntities(
    params: {
      filterUserId?: string[]
      filterEntity?: SanctionsScreeningEntity[]
      filterEntityType?: SanctionsDetailsEntityType[]
    } & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsWhitelistEntity>> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const filter: Filter<SanctionsWhitelistEntity> = {}
    if (params.filterUserId) {
      filter.userId = { $in: params.filterUserId }
    }
    if (params.filterEntity) {
      filter.entity = { $in: params.filterEntity }
    }
    if (params.filterEntityType) {
      filter.entityType = { $in: params.filterEntityType }
    }
    const results = await cursorPaginate<SanctionsWhitelistEntity>(
      collection,
      filter,
      {
        ...params,
        sortField: params.sortField || 'createdAt',
      }
    )

    return {
      ...results,
      items: results.items,
    }
  }
}
