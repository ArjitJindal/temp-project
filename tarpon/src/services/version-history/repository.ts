import { Filter, MongoClient } from 'mongodb'
import { WithOperators } from 'thunder-schema'
import { DefaultApiGetVersionHistoryRequest } from '@/@types/openapi-internal/RequestParameters'
import { VersionHistory } from '@/@types/openapi-internal/VersionHistory'
import { traceable } from '@/core/xray'
import {
  VersionHistoryTable,
  VersionHistoryTableSchema,
} from '@/models/version-history'
import {
  getClickhouseCredentials,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { VERSION_HISTORY_COLLECTION } from '@/utils/mongodb-definitions'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'

@traceable
export class VersionHistoryRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
  }

  async createVersionHistoryInMongo(versionHistory: VersionHistory) {
    await this.mongoDb
      .db()
      .collection<VersionHistory>(VERSION_HISTORY_COLLECTION(this.tenantId))
      .insertOne(versionHistory)
  }

  async createVersionHistory(versionHistory: VersionHistory) {
    if (!isClickhouseEnabledInRegion()) {
      await this.createVersionHistoryInMongo(versionHistory)
      return
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new VersionHistoryTable({
      credentials,
    })
    await clickhouseRepository
      .create({
        ...versionHistory,
        data: JSON.stringify(versionHistory.data),
      })
      .save()
  }

  private buildFilters(params: DefaultApiGetVersionHistoryRequest): {
    clickhouse: Partial<WithOperators<VersionHistoryTableSchema>>
    mongo: Filter<VersionHistory>
  } {
    const type = params.type
    const id = params.filterVersionId ?? undefined
    const createdBy = params.filterCreatedBy ?? undefined
    const filterBeforeTimestamp = params.filterBeforeTimestamp
    const filterAfterTimestamp = params.filterAfterTimestamp

    // Clickhouse filters
    const clickhouseFilters: Partial<WithOperators<VersionHistoryTableSchema>> =
      { type }
    if (id != null) {
      clickhouseFilters.id = id
    }
    if (createdBy != null) {
      clickhouseFilters.createdBy__in = createdBy
    }

    if (filterBeforeTimestamp != null && filterAfterTimestamp != null) {
      clickhouseFilters.createdAt__lt = filterBeforeTimestamp
      clickhouseFilters.createdAt__gt = filterAfterTimestamp
    }

    // Mongo filters
    const mongoFilters: Filter<VersionHistory> = { type }
    if (id != null) {
      mongoFilters.id = id
    }
    if (createdBy != null) {
      mongoFilters.createdBy = { $in: createdBy }
    }
    if (filterBeforeTimestamp != null && filterAfterTimestamp != null) {
      mongoFilters.createdAt = {
        $gte: filterAfterTimestamp,
        $lte: filterBeforeTimestamp,
      }
    }

    return { clickhouse: clickhouseFilters, mongo: mongoFilters }
  }

  private getFilters(
    params: DefaultApiGetVersionHistoryRequest
  ): Partial<WithOperators<VersionHistoryTableSchema>> {
    return this.buildFilters(params).clickhouse
  }

  async getVersionHistoryMongo(
    params: DefaultApiGetVersionHistoryRequest
  ): Promise<VersionHistory[]> {
    const result = await this.mongoDb
      .db()
      .collection<VersionHistory>(VERSION_HISTORY_COLLECTION(this.tenantId))
      .find(this.buildFilters(params).mongo)
      .project({
        data: 0,
      })
      .toArray()

    return result as VersionHistory[]
  }

  async getVersionHistory(
    params: DefaultApiGetVersionHistoryRequest
  ): Promise<VersionHistory[]> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getVersionHistoryMongo(params)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new VersionHistoryTable({
      credentials,
    })

    const filters = this.getFilters(params)

    const result = await clickhouseRepository.objects
      .filter(filters)
      .final()
      .limit(params.pageSize ?? DEFAULT_PAGE_SIZE)
      .offset(((params.page ?? 1) - 1) * (params.pageSize ?? DEFAULT_PAGE_SIZE))
      .sort({
        [params.sortField ?? 'createdAt']:
          params.sortOrder === 'descend' ? -1 : 1,
      })
      .project(['id', 'createdAt', 'createdBy', 'type', 'comment', 'updatedAt'])
      .all()

    return result.map((item) => ({
      ...item,
      data: JSON.parse('{}'),
    }))
  }

  async getVersionHistoryCountMongo(
    params: DefaultApiGetVersionHistoryRequest
  ): Promise<number> {
    const result = await this.mongoDb
      .db()
      .collection<VersionHistory>(VERSION_HISTORY_COLLECTION(this.tenantId))
      .countDocuments(this.buildFilters(params).mongo)

    return result
  }

  async getVersionHistoryCount(
    params: DefaultApiGetVersionHistoryRequest
  ): Promise<number> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getVersionHistoryCountMongo(params)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new VersionHistoryTable({ credentials })

    const filters = this.getFilters(params)

    const count = await clickhouseRepository.objects
      .filter(filters)
      .final()
      .count()

    return count
  }

  private async getVersionHistoryByIdMongo(
    id: string
  ): Promise<VersionHistory | null> {
    const versionHistory = await this.mongoDb
      .db()
      .collection<VersionHistory>(VERSION_HISTORY_COLLECTION(this.tenantId))
      .findOne({ id })

    if (!versionHistory) {
      return null
    }

    return versionHistory
  }

  async getVersionHistoryById(id: string): Promise<VersionHistory | null> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getVersionHistoryByIdMongo(id)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const table = new VersionHistoryTable({ credentials })

    const versionHistory = await table.objects.filter({ id }).final().first()

    if (!versionHistory) {
      return null
    }

    return {
      ...versionHistory,
      data: JSON.parse(versionHistory.data),
    }
  }
}
