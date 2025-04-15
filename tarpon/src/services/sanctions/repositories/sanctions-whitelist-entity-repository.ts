import { Filter, MongoClient, ReplaceOneModel } from 'mongodb'
import { isNil, omitBy } from 'lodash'
import { getDefaultProviders } from '../utils'
import { withTransaction } from '@/utils/mongodb-utils'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { traceable } from '@/core/xray'
import {
  cursorPaginate,
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/utils/pagination'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'

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
  mongoDb: MongoClient
  counterRepository: CounterRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.counterRepository = new CounterRepository(this.tenantId, mongoDb)
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
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )

    const ids = await this.counterRepository.getNextCountersAndUpdate(
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

    return {
      newRecords: replaceOneUpdates.map((update) => update.replacement),
    }
  }

  public async removeWhitelistEntities(
    sanctionsWhitelistIds: string[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    await collection.deleteMany({
      sanctionsWhitelistId: { $in: sanctionsWhitelistIds },
    })
  }

  public async clear(): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    await collection.deleteMany({})
  }

  public async getWhitelistEntities(
    requestEntityIds: string[],
    subject: WhitelistSubject,
    limit = Number.MAX_SAFE_INTEGER,
    providerOverride?: SanctionsDataProviderName
  ): Promise<SanctionsWhitelistEntity[]> {
    const provider = providerOverride ?? getDefaultProviders()?.[0]
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )

    // Choose filter fields based on entity type
    const filterFields =
      subject.entity === 'USER'
        ? USER_ENTITY_FILTER_FIELDS
        : OTHER_ENTITY_FILTER_FIELDS

    const filters = [
      // TODO change this after release.
      // https://github.com/flagright/orca/pull/4677
      {
        $or: [
          { 'sanctionsEntity.id': { $in: requestEntityIds } },
          { 'caEntity.id': { $in: requestEntityIds } },
        ],
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
    const db = this.mongoDb.db()
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
