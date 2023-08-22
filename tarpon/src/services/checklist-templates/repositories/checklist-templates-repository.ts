import { MongoClient, AggregationCursor } from 'mongodb'
import { v4 as uuid4 } from 'uuid'
import {
  CHECKLIST_TEMPLATE_COLLECTION,
  paginatePipeline,
} from '@/utils/mongoDBUtils'
import { DefaultApiGetChecklistTemplatesRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'

function getNewChecklistItemId() {
  return `item:${uuid4()}`
}

@traceable
export class ChecklistTemplateRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async getChecklistTemplates(
    params: DefaultApiGetChecklistTemplatesRequest
  ): Promise<{ total: number; data: ChecklistTemplate[] }> {
    const cursor = this.getChecklistTemplatesCursor(params)
    const total = await this.getChecklistTemplatesCount()
    return { total, data: await cursor.toArray() }
  }

  public async getChecklistTemplate(
    templateId: string
  ): Promise<ChecklistTemplate | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ id: templateId! })
  }

  public async createOrUpdateChecklistTemplate(
    template: ChecklistTemplate
  ): Promise<ChecklistTemplate> {
    const db = this.mongoDb.db()
    const collection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(this.tenantId)
    )
    const templateId = template.id ?? uuid4()
    template.id = templateId
    template.categories.map((category) => {
      category.checklistItems.forEach((item) => {
        if (!item.id) {
          item.id = getNewChecklistItemId()
        }
      })
    })
    await collection.replaceOne(
      {
        id: templateId,
      },
      template,
      { upsert: true }
    )
    return template
  }

  public async deleteChecklistTemplate(templateId: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ id: templateId! })
  }

  private getChecklistTemplatesCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(this.tenantId)
    )
    return collection.countDocuments()
  }

  public getChecklistTemplatesCursor(
    params: DefaultApiGetChecklistTemplatesRequest
  ): AggregationCursor<ChecklistTemplate> {
    const db = this.mongoDb.db()
    const collection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(this.tenantId)
    )
    return collection.aggregate<ChecklistTemplate>([
      { $sort: { createdAt: -1 } },
      ...paginatePipeline(params),
    ])
  }
}
