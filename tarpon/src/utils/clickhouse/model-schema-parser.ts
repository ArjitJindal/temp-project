import * as Models from '@/@types/openapi-internal/all'

/**
 * Interface for model attribute type mapping (matches your existing models)
 */
interface AttributeTypeMap {
  name: string
  baseName: string
  type: string
  format: string
}

/**
 * Interface for model class with attributeTypeMap
 */
interface ModelClass {
  attributeTypeMap: AttributeTypeMap[]
  new (): unknown
}

export interface ClickHouseColumn {
  name: string
  type: string
  nullable: boolean
  materialized?: boolean
  expression?: string
}

/**
 * Cache for resolved model schemas to handle circular references
 */
const modelSchemaCache = new Map<string, ClickHouseColumn[]>()

/**
 * Check if a type is an enum by examining the actual model
 */
const isEnumType = (typeName: string): boolean => {
  try {
    // Import the actual type file to check if it's a union of string literals
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')

    const typePath = path.resolve(
      __dirname,
      // We might need to add more such paths if there is a need to support other models from other folders
      `../../@types/openapi-internal/${typeName}.ts`
    )

    if (fs.existsSync(typePath)) {
      const content = fs.readFileSync(typePath, 'utf8')

      // Check if it's a union type of string literals (enum pattern)
      const unionTypeRegex = new RegExp(
        `export type ${typeName} = ("[^"]+")( \\| ("[^"]+"))+`
      )
      return unionTypeRegex.test(content)
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check if a type is a complex object by examining the actual model
 */
const isComplexObjectType = (typeName: string): boolean => {
  try {
    const model = Models[typeName as keyof typeof Models] as
      | ModelClass
      | undefined

    // If it has attributeTypeMap, it's a complex object
    return Boolean(model && Array.isArray(model.attributeTypeMap))
  } catch {
    return false
  }
}

/**
 * Map TypeScript/OpenAPI type to ClickHouse type
 */
const mapTypeScriptTypeToClickHouse = (
  type: string,
  format: string = ''
): { type: string; nullable: boolean; isUnion: boolean; isArray: boolean } => {
  // Handle nullable types (e.g., "string | null")
  const isNullable = type.includes(' | null') || type.includes(' | undefined')
  const cleanType = type
    .replace(/ \| null/g, '')
    .replace(/ \| undefined/g, '')
    .trim()

  // Handle union types (e.g., "InternalConsumerUser | InternalBusinessUser")
  const isUnion = cleanType.includes(' | ') && !cleanType.startsWith('Array<')

  // Handle arrays (e.g., "Array<string>", "string[]")
  const isArray = cleanType.startsWith('Array<') || cleanType.endsWith('[]')

  if (isArray) {
    const arrayType = cleanType.startsWith('Array<')
      ? cleanType.match(/Array<(.+)>/)?.[1] || 'String'
      : cleanType.replace('[]', '')

    const itemType = mapTypeScriptTypeToClickHouse(arrayType, format)
    return {
      type: `Array(${itemType.type})`,
      nullable: isNullable,
      isUnion: false,
      isArray: true,
    }
  }

  if (isUnion) {
    return {
      type: 'JSON',
      nullable: true,
      isUnion: true,
      isArray: false,
    }
  }

  // Handle primitive types
  switch (cleanType.toLowerCase()) {
    case 'string':
      if (format === 'date-time') {
        return {
          type: 'DateTime64(3)',
          nullable: isNullable,
          isUnion: false,
          isArray: false,
        }
      }
      if (format === 'date') {
        return {
          type: 'Date',
          nullable: isNullable,
          isUnion: false,
          isArray: false,
        }
      }
      return {
        type: 'String',
        nullable: isNullable,
        isUnion: false,
        isArray: false,
      }

    case 'number':
      return {
        type: 'Float64',
        nullable: isNullable,
        isUnion: false,
        isArray: false,
      }

    case 'integer':
      if (format === 'int64') {
        return {
          type: 'Int64',
          nullable: isNullable,
          isUnion: false,
          isArray: false,
        }
      }
      return {
        type: 'Int32',
        nullable: isNullable,
        isUnion: false,
        isArray: false,
      }

    case 'boolean':
      return {
        type: 'Bool',
        nullable: isNullable,
        isUnion: false,
        isArray: false,
      }

    default:
      if (isEnumType(cleanType)) {
        return {
          type: 'LowCardinality(String)',
          nullable: isNullable,
          isUnion: false,
          isArray: false,
        }
      }

      if (isComplexObjectType(cleanType)) {
        return {
          type: 'JSON',
          nullable: isNullable,
          isUnion: false,
          isArray: false,
        }
      }

      return {
        type: 'String',
        nullable: isNullable,
        isUnion: false,
        isArray: false,
      }
  }
}

/**
 * Generate ClickHouse columns from a model's attributeTypeMap
 */
export const generateColumnsFromModel = (
  modelName: string,
  options?: {
    excludeFields?: string[]
    includeFields?: string[]
  }
): ClickHouseColumn[] => {
  const cacheKey = `${modelName}_${JSON.stringify(options)}`
  const cachedResult = modelSchemaCache.get(cacheKey)
  if (cachedResult) {
    return cachedResult
  }

  const validation = validateModel(modelName)
  if (!validation.isValid) {
    throw new Error(`Model ${modelName} not found`)
  }

  const model = Models[modelName as keyof typeof Models] as ModelClass

  const columns: ClickHouseColumn[] = []

  model.attributeTypeMap.forEach((attr) => {
    if (options?.excludeFields?.includes(attr.name)) {
      return
    }
    if (options?.includeFields && !options.includeFields.includes(attr.name)) {
      return
    }

    const typeInfo = mapTypeScriptTypeToClickHouse(attr.type, attr.format)

    columns.push({
      name: attr.name,
      type: typeInfo.type,
      nullable: typeInfo.nullable,
    })
  })

  modelSchemaCache.set(cacheKey, columns)
  return columns
}

/**
 * Generate ClickHouse table schema from model
 */
export const generateTableSchemaFromModel = (
  modelName: string,
  tableConfig: {
    tableName: string
    idColumn: string
    timestampColumn: string
    engine?: 'ReplacingMergeTree' | 'AggregatingMergeTree' | 'SummingMergeTree'
    orderBy?: string
    primaryKey?: string
    partitionBy?: string
  }
): {
  tableName: string
  columns: ClickHouseColumn[]
  idColumn: string
  timestampColumn: string
  engine: string
  orderBy: string
  primaryKey: string
  partitionBy?: string
} => {
  const columns = generateColumnsFromModel(modelName)

  const hasIdColumn = columns.some((col) => col.name === tableConfig.idColumn)
  const hasTimestampColumn = columns.some(
    (col) => col.name === tableConfig.timestampColumn
  )

  if (!hasIdColumn) {
    columns.unshift({
      name: tableConfig.idColumn,
      type: 'String',
      nullable: false,
    })
  }

  if (!hasTimestampColumn) {
    columns.push({
      name: tableConfig.timestampColumn,
      type: 'UInt64',
      nullable: false,
    })
  }

  return {
    tableName: tableConfig.tableName,
    columns,
    idColumn: tableConfig.idColumn,
    timestampColumn: tableConfig.timestampColumn,
    engine: tableConfig.engine || 'ReplacingMergeTree',
    orderBy:
      tableConfig.orderBy ||
      `(${tableConfig.timestampColumn}, ${tableConfig.idColumn})`,
    primaryKey:
      tableConfig.primaryKey ||
      `(${tableConfig.timestampColumn}, ${tableConfig.idColumn})`,
    partitionBy:
      tableConfig.partitionBy ||
      `toYYYYMM(toDateTime(${tableConfig.timestampColumn} / 1000))`,
  }
}

/**
 * Get all available model names
 */
export const getAvailableModels = (): string[] => {
  return Object.keys(Models).filter((key) => {
    const model = Models[key as keyof typeof Models] as ModelClass | undefined
    return model?.attributeTypeMap && Array.isArray(model.attributeTypeMap)
  })
}

/**
 * Validate that a model exists and has the required structure
 */
export const validateModel = (
  modelName: string
): {
  isValid: boolean
  errors: string[]
  attributeCount: number
} => {
  const errors: string[] = []

  const model = Models[modelName as keyof typeof Models] as ModelClass
  if (!model) {
    errors.push(`Model ${modelName} not found`)
    return { isValid: false, errors, attributeCount: 0 }
  }

  if (!model.attributeTypeMap) {
    errors.push(`Model ${modelName} has no attributeTypeMap`)
    return { isValid: false, errors, attributeCount: 0 }
  }

  if (!Array.isArray(model.attributeTypeMap)) {
    errors.push(`Model ${modelName} attributeTypeMap is not an array`)
    return { isValid: false, errors, attributeCount: 0 }
  }

  return {
    isValid: true,
    errors: [],
    attributeCount: model.attributeTypeMap.length,
  }
}

/**
 * Interface for model inspection results
 */
export interface ModelInspection {
  modelName: string
  isValid: boolean
  attributeCount: number
  attributes: Array<{
    name: string
    baseName: string
    type: string
    format: string
    clickHouseType: string
    nullable: boolean
    isUnion: boolean
    isArray: boolean
  }>
  errors: string[]
}

/**
 * Debug utility to inspect a model's structure
 */
export const inspectModel = (modelName: string): ModelInspection => {
  const validation = validateModel(modelName)

  if (!validation.isValid) {
    return {
      modelName,
      isValid: false,
      attributeCount: 0,
      attributes: [],
      errors: validation.errors,
    }
  }

  const model = Models[modelName as keyof typeof Models] as ModelClass
  const attributes = model.attributeTypeMap.map((attr) => {
    const typeInfo = mapTypeScriptTypeToClickHouse(attr.type, attr.format)

    return {
      name: attr.name,
      baseName: attr.baseName,
      type: attr.type,
      format: attr.format,
      clickHouseType: typeInfo.type,
      nullable: typeInfo.nullable,
      isUnion: typeInfo.isUnion,
      isArray: typeInfo.isArray,
    }
  })

  return {
    modelName,
    isValid: true,
    attributeCount: attributes.length,
    attributes,
    errors: [],
  }
}
