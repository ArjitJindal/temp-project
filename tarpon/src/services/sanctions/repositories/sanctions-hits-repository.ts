import { MongoClient, UpdateResult, Filter } from 'mongodb'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { traceable } from '@/core/xray'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongodb-definitions'
import { CounterRepository } from '@/services/counter/repository'
import {
  cursorPaginate,
  CursorPaginationResponse,
  CursorPaginationParams,
} from '@/utils/pagination'
import { notEmpty } from '@/utils/array'
import { SanctionsWhitelistEntityRepository } from '@/services/sanctions/repositories/sanctions-whitelist-entity-repository'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

export interface HitsFilters {
  filterHitIds?: string[]
  filterSearchId?: string[]
  filterStatus?: SanctionsHitStatus[]
}

@traceable
export class SanctionsHitsRepository {
  tenantId: string
  mongoDb: MongoClient
  counterRepository: CounterRepository
  sanctionsWhitelistEntityRepository: SanctionsWhitelistEntityRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.counterRepository = new CounterRepository(this.tenantId, mongoDb)
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, mongoDb)
  }

  async searchHits(
    params: HitsFilters & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsHit>> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )
    const filter: Filter<SanctionsHit> = {}
    if (params?.filterHitIds) {
      filter.sanctionsHitId = { $in: params?.filterHitIds }
    }
    if (params?.filterStatus) {
      filter.status = { $in: params?.filterStatus }
    }
    if (params?.filterSearchId) {
      filter.searchId = { $in: params?.filterSearchId }
    }
    const results = await cursorPaginate<SanctionsHit>(collection, filter, {
      ...params,
      sortField: params.sortField || 'sanctionsHitId',
    })
    return {
      ...results,
      items: results.items,
    }
  }

  public async *iterateHits(
    filters: HitsFilters = {}
  ): AsyncIterable<SanctionsHit> {
    let nextCursor: string | undefined = undefined
    do {
      const nextPage = await this.searchHits({
        ...filters,
        fromCursorKey: nextCursor,
      })
      for (const item of nextPage.items) {
        yield item
      }
      nextCursor = nextPage.hasNext ? nextPage.next : undefined
    } while (nextCursor != null)
  }

  async addHits(
    searchId: string,
    rawHits: SanctionsEntity[],
    hitContext: SanctionsHitContext | undefined
  ): Promise<SanctionsHit[]> {
    if (rawHits.length === 0) {
      return []
    }
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const filteredHits = await this.filterWhitelistedHits(rawHits, hitContext)

    const ids = await this.counterRepository.getNextCountersAndUpdate(
      'SanctionsHit',
      filteredHits.length
    )

    const now = Date.now()
    const docs = filteredHits.map(
      (hit, i): SanctionsHit => ({
        searchId,
        status: 'OPEN' as const,
        sanctionsHitId: `SH-${ids[i]}`,
        createdAt: now,
        updatedAt: now,
        hitContext,
        entity: hit,
      })
    )

    if (docs.length > 0) {
      await collection.insertMany(docs)
    }

    return docs
  }

  public async addNewHits(
    searchId: string,
    rawHits: SanctionsEntity[],
    hitContext: SanctionsHitContext | undefined
  ): Promise<SanctionsHit[]> {
    if (rawHits.length === 0) {
      return []
    }
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const entityIds: (string | undefined)[] = (
      await collection
        .aggregate<{ entityId: string | undefined }>([
          {
            $match: {
              searchId,
            },
          },
          {
            $project: {
              entityId: '$entity.id',
            },
          },
        ])
        .toArray()
    ).map((x) => x['entityId'])

    const newHits = rawHits.filter((x) => {
      return x?.id != null && !entityIds.includes(x?.id)
    })

    return await this.addHits(searchId, newHits, hitContext)
  }

  /*
    For passed raw hits creates missing hits and update existed hits entities
   */
  public async mergeHits(
    searchId: string,
    rawHits: SanctionsEntity[],
    hitContext: SanctionsHitContext | undefined
  ): Promise<{
    updatedIds: string[]
    newIds: string[]
  }> {
    // Update existed hits
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const entityIds = rawHits.map((x) => x.id)
    const foundHitsCursor = collection.find({
      searchId: searchId,
      'entity.id': { $in: entityIds },
    })
    const updatedIds: string[] = []
    for await (const { sanctionsHitId, entity } of foundHitsCursor) {
      const newEntity = rawHits.find((x) => x.id === entity.id)
      if (newEntity) {
        const updateResult = await collection.updateOne(
          {
            sanctionsHitId,
          },
          {
            $set: {
              entity: newEntity,
            },
          }
        )
        if (updateResult.matchedCount > 0) {
          updatedIds.push(sanctionsHitId)
        }
      }
    }

    // Add new hits
    const newHits = await this.addNewHits(searchId, rawHits, hitContext)
    return {
      updatedIds,
      newIds: newHits.map((x) => x.sanctionsHitId),
    }
  }

  async filterWhitelistedHits(
    rawHits: SanctionsEntity[],
    hitContext?: SanctionsHitContext
  ): Promise<SanctionsEntity[]> {
    const entityIds = rawHits.map((x) => x?.id).filter(notEmpty)
    const subject = {
      userId: hitContext?.userId,
      entity: hitContext?.entity,
      entityType: hitContext?.entityType,
      searchTerm: hitContext?.searchTerm,
    }
    const whitelistEntities =
      await this.sanctionsWhitelistEntityRepository.getWhitelistEntities(
        entityIds,
        subject
      )
    return rawHits.filter(
      (x) =>
        !whitelistEntities.some(
          (y) => x?.id === (y.sanctionsEntity?.id || y.caEntity?.id)
        )
    )
  }

  async updateHitsByIds(
    ids: string[],
    updates: Partial<SanctionsHit>
  ): Promise<Pick<UpdateResult<SanctionsHit>, 'modifiedCount'>> {
    if (ids.length === 0) {
      return {
        modifiedCount: 0,
      }
    }
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )
    return await collection.updateMany(
      {
        sanctionsHitId: { $in: ids },
      },
      {
        $set: updates,
      }
    )
  }
}
