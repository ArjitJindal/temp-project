import { snakeCase } from 'lodash'
import { JSONSchema } from 'json-schema-to-typescript'
import * as Models from '@/@types/openapi-internal/all'
import * as CustomModelData from '@/@types/openapi-internal-custom/all'
import { EntityModel } from '@/@types/model'

const formatTypes = new Set(['date', 'date-time', 'datetime'])

const typeMap: Record<string, JSONSchema> = {
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  integer: { type: 'integer' },
  date: { type: 'string', format: 'date' },
  'date-time': { type: 'string', format: 'date-time' },
  datetime: { type: 'string', format: 'date-time' },
  any: { type: 'object' },
  object: { type: 'object' },
}

const primitiveTypes = new Set(Object.keys(typeMap))

// Memoization cache for generated schemas
const schemaCache = new Map<typeof EntityModel, JSONSchema>()

// Memoization cache for enum values
const enumCache = new Map<string, string[]>()

export function generateJsonSchemaFromEntityClass(
  entityClass: typeof EntityModel
): JSONSchema {
  // Check cache first
  if (schemaCache.has(entityClass)) {
    return schemaCache.get(entityClass) as JSONSchema
  }

  // Map attribute type to JSON schema type
  function mapType(
    attributeType: string,
    attribute: (typeof EntityModel.attributeTypeMap)[number]
  ): JSONSchema {
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

    // Handle enums with caching
    const enumKey = `${snakeCase(attributeType).toUpperCase()}S`
    if (!enumCache.has(enumKey)) {
      const enumValues = CustomModelData[enumKey] as string[]
      enumCache.set(enumKey, enumValues || [])
    }
    const enumValues = enumCache.get(enumKey)
    if (enumValues && enumValues.length > 0) {
      return { type: 'string', enum: enumValues }
    }

    // Handle primitive types
    if (primitiveTypes.has(attributeType)) {
      const baseType = typeMap[attributeType]
      // Only add format for date-related types
      if (formatTypes.has(attributeType) && attribute.format) {
        return { ...baseType, format: attribute.format }
      }
      return baseType
    }

    // Handle nested models
    const model = Models[attributeType]
    if (model) {
      return generateJsonSchemaFromEntityClass(model)
    }

    // Fallback
    return { type: 'string' }
  }

  const properties: Record<string, JSONSchema> = {}
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
  const schema: JSONSchema = {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  }

  // Cache the result
  schemaCache.set(entityClass, schema)
  return schema
}

// Utility function to clear caches if needed
export function clearJsonSchemaCaches(): void {
  schemaCache.clear()
  enumCache.clear()
}
