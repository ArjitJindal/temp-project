import {
  MongoClient,
  UpdateResult,
  Filter,
  Document,
  FindCursor,
} from 'mongodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { traceable } from '@/core/xray'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongo-table-names'
import { CounterRepository } from '@/services/counter/repository'
import { cursorPaginate } from '@/utils/pagination'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
  PaginationParams,
} from '@/@types/pagination'
import { notEmpty } from '@/utils/array'
import { SanctionsWhitelistEntityRepository } from '@/services/sanctions/repositories/sanctions-whitelist-entity-repository'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

export interface HitsFilters {
  filterHitIds?: string[]
  filterSearchId?: string[]
  filterStatus?: SanctionsHitStatus[]
  filterCountry?: CountryCode[]
  filterPaymentMethodId?: string[]
  ruleId?: string
  filterUserId?: string
}

@traceable
export class SanctionsHitsRepository {
  tenantId: string
  mongoDb: MongoClient
  counterRepository: CounterRepository
  sanctionsWhitelistEntityRepository: SanctionsWhitelistEntityRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: connections.dynamoDb,
      })
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<SanctionsHitsRepository> {
    const tenantId = event.requestContext.authorizer.principalId
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    return new SanctionsHitsRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
  }

  private getSearchHitsFilters(params: HitsFilters): Document {
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
    return filter
  }

  async searchHits(
    params: HitsFilters & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsHit>> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const filter = this.getSearchHitsFilters(params)

    const results = await cursorPaginate<SanctionsHit>(collection, filter, {
      ...params,
      sortField: params.sortField || 'sanctionsHitId',
    })
    results.items = results.items.map((item) => ({
      ...item,
      entity: {
        ...item.entity,
        yearOfBirth: Array.isArray(item.entity.yearOfBirth)
          ? item.entity.yearOfBirth
          : item.entity.yearOfBirth
          ? [item.entity.yearOfBirth]
          : [],
      },
    }))
    return {
      ...results,
      items: results.items,
    }
  }

  async searchHitsOffset(filters: HitsFilters & PaginationParams): Promise<{
    items: SanctionsHit[]
    total: number
  }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    const filter = this.getSearchHitsFilters(filters)
    const itemsPromise = collection
      .find(filter)
      .skip(((filters.page ?? 1) - 1) * (filters.pageSize ?? 20))
      .limit(filters.pageSize ?? 20)
      .toArray()

    const totalPromise = collection.countDocuments(filter)

    return {
      items: await itemsPromise,
      total: await totalPromise,
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
    provider: SanctionsDataProviderName,
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
        provider,
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
    provider: SanctionsDataProviderName,
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
              'hitContext.paymentMethodId': hitContext?.paymentMethodId,
              'hitContext.userId': hitContext?.userId,
              'hitContext.entityType': hitContext?.entityType,
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

    return await this.addHits(provider, searchId, newHits, hitContext)
  }

  /*
    For passed raw hits creates missing hits and update existed hits entities
   */
  public async mergeHits(
    provider: SanctionsDataProviderName,
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
    const foundHitsCursor: FindCursor<SanctionsHit> = collection.find({
      searchId: searchId,
      'entity.id': { $in: entityIds },
      'hitContext.paymentMethodId': hitContext?.paymentMethodId,
      'hitContext.userId': hitContext?.userId,
      'hitContext.entityType': hitContext?.entityType,
    })
    const updatedIds: string[] = []
    for await (const { sanctionsHitId, entity } of foundHitsCursor) {
      const newEntity = rawHits.find((x) => x.id === entity.id)
      if (newEntity) {
        const updateResult = await collection.updateOne(
          { sanctionsHitId },
          { $set: { entity: newEntity } }
        )
        if (updateResult.matchedCount > 0) {
          updatedIds.push(sanctionsHitId)
        }
      }
    }

    // Add new hits
    const newHits = await this.addNewHits(
      provider,
      searchId,
      rawHits,
      hitContext
    )
    return {
      updatedIds,
      newIds: newHits.map((x) => x.sanctionsHitId),
    }
  }

  async filterWhitelistedHits(
    rawHits: SanctionsEntity[],
    hitContext?: SanctionsHitContext,
    provider?: SanctionsDataProviderName
  ): Promise<SanctionsEntity[]> {
    const entityIds = rawHits.map((x) => x?.id).filter(notEmpty)
    const subject = {
      userId: hitContext?.userId,
      entity: hitContext?.entity,
      entityType: hitContext?.entityType,
      searchTerm: hitContext?.searchTerm,
      paymentMethodId: hitContext?.paymentMethodId,
    }
    const whitelistEntities =
      await this.sanctionsWhitelistEntityRepository.getWhitelistEntities(
        entityIds,
        subject,
        Number.MAX_SAFE_INTEGER,
        provider
      )
    return rawHits.filter(
      (x) => !whitelistEntities.some((y) => x?.id === y.sanctionsEntity?.id)
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
      { sanctionsHitId: { $in: ids } },
      { $set: updates }
    )
  }

  public async getHitsByIds(ids: string[]): Promise<SanctionsHit[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )

    return await collection.find({ sanctionsHitId: { $in: ids } }).toArray()
  }

  public async getHitById(id: string): Promise<SanctionsHit | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ sanctionsHitId: id })
  }
}
