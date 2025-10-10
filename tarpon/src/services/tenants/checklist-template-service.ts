import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { ChecklistTemplateRepository } from './repositories/checklist-templates-repository'
import { traceable } from '@/core/xray'
import { DefaultApiGetChecklistTemplatesRequest } from '@/@types/openapi-internal/RequestParameters'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'

export type ChecklistTemplateWithId = ChecklistTemplate & { id: string }

@traceable
export class ChecklistTemplatesService {
  tenantId: string
  repository: ChecklistTemplateRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.repository = new ChecklistTemplateRepository(tenantId, mongoDb)
  }

  public async getChecklistTemplate(checklistTemplateId: string) {
    return this.repository.getChecklistTemplate(checklistTemplateId)
  }

  public async getChecklistTemplates(
    params: DefaultApiGetChecklistTemplatesRequest
  ) {
    return this.repository.getChecklistTemplates(params)
  }
  public async createChecklistTemplate(template: ChecklistTemplate) {
    if (
      template.id &&
      (await this.repository.getChecklistTemplate(template.id))
    ) {
      throw new BadRequest(`Checklist template ${template.id} already exists`)
    }
    const now = Date.now()
    return this.repository.createOrUpdateChecklistTemplate({
      ...template,
      status: template.status ?? 'DRAFT',
      createdAt: now,
      updatedAt: now,
    })
  }

  public async updateChecklistTemplate(template: ChecklistTemplateWithId) {
    const existingTemplate = await this.repository.getChecklistTemplate(
      template.id
    )
    if (!existingTemplate) {
      throw new NotFound(`Checklist template ${template.id}  not found`)
    }
    return this.repository.createOrUpdateChecklistTemplate({
      ...template,
      createdAt: existingTemplate.createdAt,
      updatedAt: Date.now(),
    })
  }

  public async getChecklistTemplateByIds(templateIds: string[]) {
    return this.repository.getChecklistTemplateByIds(templateIds)
  }

  public async deleteChecklistTemplate(templateId: string) {
    if (!(await this.repository.getChecklistTemplate(templateId))) {
      throw new NotFound(`Checklist template ${templateId}  not found`)
    }
    return this.repository.deleteChecklistTemplate(templateId)
  }
}
