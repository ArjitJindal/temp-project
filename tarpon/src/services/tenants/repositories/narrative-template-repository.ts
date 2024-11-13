import { Collection, MongoClient } from 'mongodb'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'
import { paginateCursor } from '@/utils/mongodb-utils'
import { NARRATIVE_TEMPLATE_COLLECTION } from '@/utils/mongodb-definitions'
import { NarrativeTemplateRequest } from '@/@types/openapi-internal/NarrativeTemplateRequest'
import { DefaultApiGetNarrativesRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'

@traceable
export class NarrativeRepository {
  private collection: Collection<NarrativeTemplate>

  constructor(tenantId: string, mongoClient: MongoClient) {
    this.collection = mongoClient
      .db()
      .collection<NarrativeTemplate>(NARRATIVE_TEMPLATE_COLLECTION(tenantId))
  }

  public async getNarrativeTemplate(
    narrativeTemplateId: string
  ): Promise<NarrativeTemplate | null> {
    return await this.collection.findOne({ id: narrativeTemplateId })
  }

  public async getNarrativeTemplates(params: DefaultApiGetNarrativesRequest) {
    const cursor = this.collection.find({}).sort({ createdAt: -1 })

    const paginatedCursor = paginateCursor<
      DefaultApiGetNarrativesRequest,
      NarrativeTemplate
    >(cursor, params)

    return await paginatedCursor.toArray()
  }

  public async getNarrativeTemplatesCount(): Promise<number> {
    return await this.collection.countDocuments()
  }

  public async createNarrativeTemplate(
    narrative: NarrativeTemplate
  ): Promise<NarrativeTemplate> {
    await this.collection.insertOne(narrative)
    return narrative
  }

  public async updateNarrativeTemplate(
    narrativeTemplateId: string,
    narrative: NarrativeTemplateRequest & { updatedAt: number }
  ): Promise<NarrativeTemplate | null> {
    const data = await this.collection.findOneAndUpdate(
      { id: narrativeTemplateId },
      { $set: { ...narrative } }
    )

    return data.value
  }

  public async deleteNarrativeTemplate(narrativeTemplateId: string) {
    await this.collection.deleteOne({ id: narrativeTemplateId })
  }
}
