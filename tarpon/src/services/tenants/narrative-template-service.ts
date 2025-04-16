import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { PermissionsService } from '../rbac'
import { NarrativeRepository } from './repositories/narrative-template-repository'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'
import { NarrativeTemplateResponse } from '@/@types/openapi-internal/NarrativeTemplateResponse'
import { NarrativeTemplateRequest } from '@/@types/openapi-internal/NarrativeTemplateRequest'
import { DefaultApiGetNarrativesRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'

@traceable
export class NarrativeService {
  private narrativeRepository: NarrativeRepository
  private permissionsService: PermissionsService

  constructor(tenantId: string, mongoClient: MongoClient) {
    this.narrativeRepository = new NarrativeRepository(tenantId, mongoClient)
    this.permissionsService = new PermissionsService(tenantId)
  }

  public async getNarrativeTemplate(
    narrativeTemplateId: string
  ): Promise<NarrativeTemplate> {
    const narrative = await this.narrativeRepository.getNarrativeTemplate(
      narrativeTemplateId
    )

    if (!narrative) {
      throw new NotFound('NarrativeTemplate not found')
    }

    return narrative
  }

  public async getNarrativeTemplates(
    params: DefaultApiGetNarrativesRequest
  ): Promise<NarrativeTemplateResponse> {
    const count = await this.narrativeRepository.getNarrativeTemplatesCount()
    const narratives = await this.narrativeRepository.getNarrativeTemplates(
      params
    )

    return { total: count, items: narratives }
  }

  public async createNarrativeTemplate(
    narrative: NarrativeTemplateRequest
  ): Promise<NarrativeTemplate> {
    const id = uuidv4()

    const createdAt = Date.now()

    const newNarrative: NarrativeTemplate = {
      id,
      createdAt,
      updatedAt: createdAt,
      ...narrative,
    }

    const data = await this.narrativeRepository.createNarrativeTemplate(
      newNarrative
    )

    await this.permissionsService.insertDynamicPermission(
      'NARRATIVE_TEMPLATES',
      { id, name: newNarrative.name }
    )

    return data
  }

  public async updateNarrativeTemplate(
    narrativeTemplateId: string,
    narrative: NarrativeTemplateRequest
  ): Promise<NarrativeTemplate> {
    const updatedAt = Date.now()

    const data = await this.narrativeRepository.updateNarrativeTemplate(
      narrativeTemplateId,
      { ...narrative, updatedAt }
    )
    if (!data) {
      throw new NotFound('NarrativeTemplate not found')
    }

    await this.permissionsService.insertDynamicPermission(
      'NARRATIVE_TEMPLATES',
      { id: data.id, name: data.name }
    )

    return data
  }

  public async deleteNarrativeTemplate(
    narrativeTemplateId: string
  ): Promise<void> {
    await this.permissionsService.deleteDynamicPermission(
      'NARRATIVE_TEMPLATES',
      narrativeTemplateId
    )

    return this.narrativeRepository.deleteNarrativeTemplate(narrativeTemplateId)
  }
}
