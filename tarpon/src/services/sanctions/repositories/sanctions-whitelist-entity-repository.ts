import { Filter, MongoClient } from 'mongodb'
import { isNil, omitBy } from 'lodash'
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
import { notEmpty } from '@/utils/array'
import { complyAdvantageDocToEntity } from '@/services/sanctions/providers/comply-advantage-provider'

const SUBJECT_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'screenEntity',
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

    const results = await withTransaction(async () => {
      return await Promise.all(
        entities.map(
          async (entity, i): Promise<SanctionsWhitelistEntity | null> => {
            const result = await collection.findOneAndReplace(
              {
                'sanctionsEntity.id': entity.id,
                ...definedFields,
              },
              {
                sanctionsEntity: entity,
                sanctionsWhitelistId: `SW-${ids[i]}`,
                ...definedFields,
                createdAt: options?.createdAt ?? Date.now(),
                reason: options?.reason,
                comment: options?.comment,
                // TODO remove after release is stable.
                // https://github.com/flagright/orca/pull/4677
                caEntity: entity.rawResponse?.doc,
              },
              { upsert: true, returnDocument: 'after' }
            )
            return result.value
          }
        )
      )
    })
    return {
      newRecords: this.backwardsCompatibleResults(results.filter(notEmpty)),
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
    limit = Number.MAX_SAFE_INTEGER
  ): Promise<SanctionsWhitelistEntity[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const filters = [
      // TODO change this after release.
      // https://github.com/flagright/orca/pull/4677
      {
        $or: [
          { 'sanctionsEntity.id': { $in: requestEntityIds } },
          { 'caEntity.id': { $in: requestEntityIds } },
        ],
      },
      ...SUBJECT_FIELDS.map((key) => ({
        $or: [{ [key]: subject[key] }, { [key]: { $eq: null } }],
      })),
    ]
    const result = await collection
      .find({ $and: filters })
      .limit(limit)
      .toArray()
    return this.backwardsCompatibleResults(result)
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
      filter.screenEntity = { $in: params.filterEntity }
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
      items: this.backwardsCompatibleResults(results.items),
    }
  }

  // TODO remove this after release.
  // https://github.com/flagright/orca/pull/4677
  private backwardsCompatibleResults(results: SanctionsWhitelistEntity[]) {
    return results.map((result) => {
      if (!result.sanctionsEntity && result.caEntity) {
        result.sanctionsEntity = complyAdvantageDocToEntity({
          doc: result.caEntity,
        })
      }
      return result
    })
  }
}
