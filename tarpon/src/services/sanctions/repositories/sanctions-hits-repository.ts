import { MongoClient, UpdateResult, Filter } from 'mongodb'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
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
    return cursorPaginate<SanctionsHit>(collection, filter, {
      ...params,
      sortField: params.sortField || 'sanctionsHitId',
    })
  }

  public async *iterateHits(filters: HitsFilters): AsyncIterable<SanctionsHit> {
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
    rawHits: ComplyAdvantageSearchHit[],
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
        caEntity: hit.doc,
        caMatchTypes: hit.match_types ?? [],
      })
    )

    if (docs.length > 0) {
      await collection.insertMany(docs)
    }

    return docs
  }

  public async addNewHits(
    searchId: string,
    rawHits: ComplyAdvantageSearchHit[],
    hitContext: SanctionsHitContext | undefined
  ): Promise<SanctionsHit[]> {
    if (rawHits.length === 0) {
      return []
    }
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const docIds: (string | undefined)[] = (
      await collection
        .aggregate<{ docId: string | undefined }>([
          {
            $match: {
              searchId,
            },
          },
          {
            $project: {
              docId: '$caEntity.id',
            },
          },
        ])
        .toArray()
    ).map((x) => x['docId'])

    const newHits = rawHits.filter((x) => {
      return x.doc?.id != null && !docIds.includes(x.doc?.id)
    })

    return await this.addHits(searchId, newHits, hitContext)
  }

  /*
    For passed raw hits creates missing hits and update existed hits entities
   */
  public async mergeHits(
    searchId: string,
    rawHits: ComplyAdvantageSearchHit[],
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

    const docIds = rawHits.map((x) => x.doc.id)
    const foundHitsCursor = collection.find({
      searchId: searchId,
      'caEntity.id': { $in: docIds },
    })
    const updatedIds: string[] = []
    for await (const { sanctionsHitId, caEntity } of foundHitsCursor) {
      const newCaEntity = rawHits.find((x) => x.doc.id === caEntity.id)?.doc
      if (newCaEntity) {
        const updateResult = await collection.updateOne(
          {
            sanctionsHitId,
          },
          {
            $set: {
              caEntity: newCaEntity,
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
    rawHits: ComplyAdvantageSearchHit[],
    hitContext?: SanctionsHitContext
  ): Promise<ComplyAdvantageSearchHit[]> {
    const entityIds = rawHits.map((x) => x.doc?.id).filter(notEmpty)
    const whitelistEntities =
      await this.sanctionsWhitelistEntityRepository.getWhitelistEntities(
        entityIds,
        hitContext?.userId
      )
    return rawHits.filter(
      (x) => !whitelistEntities.some((y) => x.doc?.id === y.caEntity.id)
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
