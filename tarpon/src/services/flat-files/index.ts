import { FlatFileFormat } from './format'
import { CsvFormat } from './format/csv'
import { EntityModel } from '@/@types/model'
import { CaseClosure } from '@/@types/openapi-internal/CaseClosure'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { traceable } from '@/core/xray'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'

export const FlatFileSchemaToModel: Record<FlatFileSchema, typeof EntityModel> =
  {
    BULK_CASE_CLOSURE: CaseClosure,
  }

@traceable
export class FlatFilesService {
  private readonly tenantId: string

  private formatServices: (typeof FlatFileFormat)[] = [CsvFormat]

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  async generateTemplate(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat
  ) {
    const model = FlatFileSchemaToModel[schema]
    const FormatService = this.formatServices.find(
      (service) => service.format === format
    )
    if (!FormatService) {
      throw new Error(
        `Format ${format} not found for tenant id ${this.tenantId}`
      )
    }

    const formatInstance = new (FormatService as any)(model) as FlatFileFormat
    const template = formatInstance.getTemplate()
    return template
  }
}
