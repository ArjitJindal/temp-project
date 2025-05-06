import { Collection, Filter, MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'
import { paginateCursor } from '@/utils/mongodb-utils'
import { NARRATIVE_TEMPLATE_COLLECTION } from '@/utils/mongodb-definitions'
import { NarrativeTemplateRequest } from '@/@types/openapi-internal/NarrativeTemplateRequest'
import { DefaultApiGetNarrativesRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { Narratives } from '@/models/narrative-template'
import {
  isClickhouseEnabled,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'

@traceable
export class NarrativeRepository {
  private collection: Collection<NarrativeTemplate>
  private clickhouseConfig?: ConnectionCredentials

  constructor(
    tenantId: string,
    mongoClient: MongoClient,
    clickhouseConfig?: ConnectionCredentials
  ) {
    this.collection = mongoClient
      .db()
      .collection<NarrativeTemplate>(NARRATIVE_TEMPLATE_COLLECTION(tenantId))
    this.clickhouseConfig = clickhouseConfig
  }

  public async getNarrativeTemplateClickhouse(
    narrativeTemplateId: string
  ): Promise<NarrativeTemplate | null> {
    const narrativeTemplate = new Narratives({
      credentials: this.clickhouseConfig as ConnectionCredentials,
    })

    const data = await narrativeTemplate.objects
      .filter({ id: narrativeTemplateId })
      .final()
      .first()

    if (!data) {
      return null
    }

    return data
  }

  public async getNarrativeTemplate(
    narrativeTemplateId: string
  ): Promise<NarrativeTemplate | null> {
    if (isClickhouseEnabled()) {
      return await this.getNarrativeTemplateClickhouse(narrativeTemplateId)
    }
    return await this.collection.findOne({ id: narrativeTemplateId })
  }

  private getFilter(params: DefaultApiGetNarrativesRequest) {
    const match: Filter<NarrativeTemplate> = {}

    if (params.filterNarrativeTemplateIds) {
      match.id = { $in: params.filterNarrativeTemplateIds }
    }

    return match
  }

  public async getNarrativeTemplates(params: DefaultApiGetNarrativesRequest) {
    if (isClickhouseEnabled()) {
      return await this.getNarrativeTemplatesClickhouse(params)
    }

    const match = this.getFilter(params)

    const cursor = this.collection.find(match).sort({ createdAt: -1 })

    const paginatedCursor = paginateCursor<
      DefaultApiGetNarrativesRequest,
      NarrativeTemplate
    >(cursor, params)

    return await paginatedCursor.toArray()
  }

  public async getNarrativeTemplatesClickhouse(
    params: DefaultApiGetNarrativesRequest
  ): Promise<NarrativeTemplate[]> {
    const narrativeModel = new Narratives({
      credentials: this.clickhouseConfig as ConnectionCredentials,
    })

    const narrative = narrativeModel.objects
      .filter({
        ...(params.filterNarrativeTemplateIds
          ? { id__in: params.filterNarrativeTemplateIds }
          : {}),
      })
      .sort({ createdAt: -1 })
      .final()

    return await narrative.all()
  }

  public async getNarrativeTemplatesCountClickhouse(
    params: DefaultApiGetNarrativesRequest
  ): Promise<number> {
    const narrativeTemplate = new Narratives({
      credentials: this.clickhouseConfig as ConnectionCredentials,
    })

    return await narrativeTemplate.objects
      .filter({
        ...(params.filterNarrativeTemplateIds
          ? { id__in: params.filterNarrativeTemplateIds }
          : {}),
      })
      .final()
      .count()
  }

  public async getNarrativeTemplatesCount(
    params: DefaultApiGetNarrativesRequest
  ): Promise<number> {
    if (isClickhouseEnabled()) {
      return await this.getNarrativeTemplatesCountClickhouse(params)
    }
    const match = this.getFilter(params)
    return await this.collection.countDocuments(match)
  }

  public async createNarrativeTemplate(
    narrative: NarrativeTemplate
  ): Promise<NarrativeTemplate> {
    if (isClickhouseEnabledInRegion()) {
      await this.createNarrativeTemplateClickhouse(narrative)
    }
    await this.collection.insertOne(narrative)
    return narrative
  }

  public async createNarrativeTemplateClickhouse(
    narrative: NarrativeTemplate
  ): Promise<NarrativeTemplate> {
    const narrativeTemplate = new Narratives({
      credentials: this.clickhouseConfig as ConnectionCredentials,
    })

    const data = narrativeTemplate.create(narrative)

    await data.save()

    return narrative
  }

  public async updateNarrativeTemplate(
    narrativeTemplateId: string,
    narrative: NarrativeTemplateRequest & { updatedAt: number }
  ): Promise<NarrativeTemplate | null> {
    const data = await this.collection.findOneAndUpdate(
      { id: narrativeTemplateId },
      { $set: { ...narrative } },
      { returnDocument: 'after' }
    )

    if (isClickhouseEnabledInRegion() && data.value) {
      await this.createNarrativeTemplateClickhouse(data.value)
    }

    return data.value
  }

  private async deleteNarrativeTemplateClickhouse(narrativeTemplateId: string) {
    const narrativeTemplate = new Narratives({
      credentials: this.clickhouseConfig as ConnectionCredentials,
    })

    await narrativeTemplate.objects.filter({ id: narrativeTemplateId }).delete()
  }

  public async deleteNarrativeTemplate(narrativeTemplateId: string) {
    if (isClickhouseEnabledInRegion()) {
      await this.deleteNarrativeTemplateClickhouse(narrativeTemplateId)
    }

    await this.collection.deleteOne({ id: narrativeTemplateId })
  }
}
