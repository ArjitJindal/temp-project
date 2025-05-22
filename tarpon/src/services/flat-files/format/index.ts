import { EntityModel } from '@/@types/model'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'

export abstract class FlatFileFormat {
  model: typeof EntityModel

  constructor(model: typeof EntityModel) {
    this.model = model
  }

  static readonly format: FlatFileTemplateFormat
  abstract getTemplate(): FlatFileTemplateResponse
}
