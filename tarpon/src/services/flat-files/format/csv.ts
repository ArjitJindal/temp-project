import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'
import { FlatFileFormat } from '@/services/flat-files/format'
import { EntityModel } from '@/@types/model'
import * as Models from '@/@types/openapi-public/all'

export class CsvFormat extends FlatFileFormat {
  static readonly format = 'CSV'

  private generateCsvTemplateFromEntityClass(
    entityClass: typeof EntityModel,
    prefix: string = ''
  ): FlatFileTemplateResponse {
    const headers: string[] = []

    // Process all attributes
    for (const attribute of entityClass.attributeTypeMap) {
      const currentPath = prefix
        ? `${prefix}.${attribute.baseName}`
        : attribute.baseName

      // Handle arrays
      if (attribute.type.startsWith('Array<')) {
        const arrayType = attribute.type.match(/Array<(.+)>/)?.[1]
        if (arrayType) {
          // For arrays, we'll add a sample index (0) to show the structure
          const arrayPath = `${currentPath}.0`
          if (Models[arrayType]) {
            // If array contains objects, recursively process them
            const nestedTemplate = this.generateCsvTemplateFromEntityClass(
              Models[arrayType],
              arrayPath
            )
            headers.push(...nestedTemplate.keys)
          } else {
            // If array contains primitives, just add the path
            headers.push(arrayPath)
          }
        }
      }
      // Handle nested objects
      else if (Models[attribute.type]) {
        const nestedTemplate = this.generateCsvTemplateFromEntityClass(
          Models[attribute.type],
          currentPath
        )
        headers.push(...nestedTemplate.keys)
      }
      // Handle primitive types
      else {
        headers.push(currentPath)
      }
    }

    // Create CSV string with headers
    const fileString = headers.join(',') + '\n'

    return {
      keys: headers,
      fileString,
    }
  }

  public getTemplate(): FlatFileTemplateResponse {
    const model = this.model
    return this.generateCsvTemplateFromEntityClass(model)
  }
}
