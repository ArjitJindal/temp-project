import { snakeCase } from 'lodash'
import * as Models from '@/@types/openapi-public/all'
import * as CustomModelData from '@/@types/openapi-public-custom/all'
import { EntityModel } from '@/@types/model'

export function generateJsonSchemaFromEntityClass(
  entityClass: typeof EntityModel
): any {
  // Map attribute type to JSON schema type
  function mapType(attributeType: string, attribute: any): any {
    // Handle union types
    if (attributeType.includes(' | ') && !attributeType.includes('Array')) {
      return {
        oneOf: attributeType
          .split(' | ')
          .map((type) => mapType(type.trim(), attribute)),
      }
    }

    // Handle arrays
    if (attributeType.startsWith('Array<')) {
      const arrayType = attributeType.match(/Array<(.+)>/)?.[1]
      if (arrayType) {
        return {
          type: 'array',
          items: mapType(arrayType, attribute),
        }
      }
    }

    // Handle maps/objects with string keys
    if (/^\{\s*\[key: string\]: (.+)\s*\}$/.test(attributeType)) {
      const valueType = attributeType.match(
        /^\{\s*\[key: string\]: (.+)\s*\}$/
      )?.[1]
      if (valueType) {
        return {
          type: 'object',
          additionalProperties: mapType(valueType, attribute),
        }
      }
    }

    // Handle enums
    const enumKey = `${snakeCase(attributeType).toUpperCase()}S`
    const enumValues = CustomModelData[enumKey] as string[]
    if (enumValues) {
      const schema: any = { type: 'string', enum: enumValues }
      if (attribute.options?.length) {
        schema.enumNames = attribute.options.map((opt: any) => opt.title)
      }
      return schema
    }

    // Handle primitive types
    const typeMap: Record<string, any> = {
      string: { type: 'string' },
      number: { type: 'number' },
      boolean: { type: 'boolean' },
      integer: { type: 'integer' },
      date: { type: 'string', format: 'date' },
      'date-time': { type: 'string', format: 'date-time' },
      datetime: { type: 'string', format: 'date-time' },
    }

    if (typeMap[attributeType]) {
      if (attribute.format && !typeMap[attributeType].format) {
        return { ...typeMap[attributeType], format: attribute.format }
      }
      return typeMap[attributeType]
    }

    // Handle nested models
    if (Models[attributeType]) {
      return generateJsonSchemaFromEntityClass(Models[attributeType])
    }

    // Fallback
    return { type: 'string' }
  }

  const properties: Record<string, any> = {}
  const required: string[] = []

  // Process all attributes
  for (const attribute of entityClass.attributeTypeMap) {
    properties[attribute.baseName] = mapType(attribute.type, attribute)

    // Check if attribute is required
    const requiredFieldsKey = `${entityClass.name}RequiredFields`
    const requiredFields = CustomModelData[requiredFieldsKey] as string[]
    if (requiredFields?.includes(attribute.baseName)) {
      required.push(attribute.baseName)
    }
  }

  // Build the schema
  const schema: any = {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  }

  return schema
}
