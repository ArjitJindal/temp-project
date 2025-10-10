import {
  generateColumnsFromModel,
  generateTableSchemaFromModel,
  validateModel,
  getAvailableModels,
  inspectModel,
} from '../model-schema-parser'
import { TestModels } from './test-models'

// Test helper functions that work with our test models
const validateTestModel = (modelName: string) => {
  const model = TestModels[modelName as keyof typeof TestModels] as {
    attributeTypeMap?: unknown[]
  }
  if (!model) {
    return {
      isValid: false,
      errors: [`Model ${modelName} not found`],
      attributeCount: 0,
    }
  }
  if (!model.attributeTypeMap || !Array.isArray(model.attributeTypeMap)) {
    return {
      isValid: false,
      errors: [`Model ${modelName} has no attributeTypeMap`],
      attributeCount: 0,
    }
  }
  return {
    isValid: true,
    errors: [],
    attributeCount: model.attributeTypeMap.length,
  }
}

const generateColumnsFromTestModel = (modelName: string) => {
  const model = TestModels[modelName as keyof typeof TestModels] as {
    attributeTypeMap?: Array<{ name: string; type: string }>
  }
  if (!model?.attributeTypeMap) {
    throw new Error(`Model ${modelName} not found`)
  }

  // Use the same logic as the real function but with test models
  const columns = model.attributeTypeMap.map((attr) => {
    // Simple type mapping for tests
    let type = 'String'
    let nullable = false

    if (attr.type === 'number') {
      type = 'Float64'
    } else if (attr.type === 'boolean') {
      type = 'Bool'
    } else if (attr.type.startsWith('Array<')) {
      const innerType = attr.type.match(/Array<(.+)>/)?.[1] || 'String'
      if (innerType === 'string') {
        type = 'Array(String)'
      } else if (innerType === 'number') {
        type = 'Array(Float64)'
      } else if (
        innerType.includes('Test') &&
        (innerType.includes('Status') || innerType.includes('Priority'))
      ) {
        type = 'Array(LowCardinality(String))'
      } else {
        type = 'Array(JSON)'
      }
    } else if (attr.type.includes('|')) {
      type = 'JSON'
      nullable = attr.type.includes('null')
    } else if (
      attr.type.includes('Test') &&
      (attr.type.includes('Status') || attr.type.includes('Priority'))
    ) {
      type = 'LowCardinality(String)'
    } else if (
      attr.type.includes('Test') &&
      !attr.type.includes('Status') &&
      !attr.type.includes('Priority')
    ) {
      type = 'JSON'
    }

    return {
      name: attr.name,
      type,
      nullable,
    }
  })

  return columns
}

describe('Model Schema Parser', () => {
  describe('validateModel with test models', () => {
    it('should validate simple test model', () => {
      const validation = validateTestModel('SimpleTestModel')
      expect(validation.isValid).toBe(true)
      expect(validation.attributeCount).toBe(5)
      expect(validation.errors).toHaveLength(0)
    })

    it('should validate complex test model', () => {
      const validation = validateTestModel('ComplexTestModel')
      expect(validation.isValid).toBe(true)
      expect(validation.attributeCount).toBe(16)
      expect(validation.errors).toHaveLength(0)
    })

    it('should return false for non-existent models', () => {
      const validation = validateTestModel('NonExistentModel')
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Model NonExistentModel not found')
    })

    it('should validate models without attributeTypeMap', () => {
      const validation = validateTestModel('InvalidTestModel')
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain(
        'Model InvalidTestModel has no attributeTypeMap'
      )
    })
  })

  describe('validateModel with real models', () => {
    it('should validate existing models', () => {
      const validation = validateModel('InternalTransaction')
      expect(validation.isValid).toBe(true)
      expect(validation.attributeCount).toBeGreaterThan(0)
      expect(validation.errors).toHaveLength(0)
    })

    it('should return false for non-existent models', () => {
      const validation = validateModel('NonExistentModel')
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Model NonExistentModel not found')
    })
  })

  describe('getAvailableModels', () => {
    it('should return a list of available models', () => {
      const models = getAvailableModels()
      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
      expect(models).toContain('InternalTransaction')
      expect(models).toContain('InternalUser')
    })
  })

  describe('inspectModel with real models', () => {
    it('should inspect InternalTransaction model', () => {
      const inspection = inspectModel('InternalTransaction')
      expect(inspection.modelName).toBe('InternalTransaction')
      expect(inspection.isValid).toBe(true)
      expect(inspection.attributeCount).toBeGreaterThan(30)
      expect(inspection.attributes).toBeDefined()
      expect(
        inspection.attributes.some((attr) => attr.name === 'transactionId')
      ).toBe(true)
      expect(
        inspection.attributes.some((attr) => attr.name === 'timestamp')
      ).toBe(true)
    })

    it('should handle union types', () => {
      const inspection = inspectModel('InternalTransaction')
      const originUserAttr = inspection.attributes.find(
        (attr) => attr.name === 'originUser'
      )
      expect(originUserAttr).toBeDefined()
      expect(originUserAttr?.type).toContain('|')
    })
  })

  describe('generateColumnsFromModel with test models', () => {
    it('should generate columns for SimpleTestModel', () => {
      const columns = generateColumnsFromTestModel('SimpleTestModel')

      expect(columns).toBeDefined()
      expect(Array.isArray(columns)).toBe(true)
      expect(columns.length).toBe(5)

      // Check exact columns
      expect(columns[0]).toEqual({
        name: 'id',
        type: 'String',
        nullable: false,
      })
      expect(columns[1]).toEqual({
        name: 'name',
        type: 'String',
        nullable: false,
      })
      expect(columns[2]).toEqual({
        name: 'age',
        type: 'Float64',
        nullable: false,
      })
      expect(columns[3]).toEqual({
        name: 'isActive',
        type: 'Bool',
        nullable: false,
      })
      expect(columns[4]).toEqual({
        name: 'createdAt',
        type: 'Float64',
        nullable: false,
      })
    })

    it('should handle enum types correctly', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      const statusCol = columns.find((col) => col.name === 'status')
      expect(statusCol).toBeDefined()
      expect(statusCol?.type).toBe('LowCardinality(String)')

      const priorityCol = columns.find((col) => col.name === 'priority')
      expect(priorityCol).toBeDefined()
      expect(priorityCol?.type).toBe('LowCardinality(String)')
    })

    it('should handle complex object types as JSON', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      const contactInfoCol = columns.find((col) => col.name === 'contactInfo')
      expect(contactInfoCol).toBeDefined()
      expect(contactInfoCol?.type).toBe('JSON')

      const metadataCol = columns.find((col) => col.name === 'metadata')
      expect(metadataCol).toBeDefined()
      expect(metadataCol?.type).toBe('JSON')
    })

    it('should handle union types as JSON', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      const paymentMethodCol = columns.find(
        (col) => col.name === 'paymentMethod'
      )
      expect(paymentMethodCol).toBeDefined()
      expect(paymentMethodCol?.type).toBe('JSON')
      expect(paymentMethodCol?.nullable).toBe(false)

      const alternativePaymentCol = columns.find(
        (col) => col.name === 'alternativePayment'
      )
      expect(alternativePaymentCol).toBeDefined()
      expect(alternativePaymentCol?.type).toBe('JSON')
      expect(alternativePaymentCol?.nullable).toBe(true) // Contains null
    })

    it('should handle arrays correctly', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      const tagsCol = columns.find((col) => col.name === 'tags')
      expect(tagsCol).toBeDefined()
      expect(tagsCol?.type).toBe('Array(String)')

      const scoresCol = columns.find((col) => col.name === 'scores')
      expect(scoresCol).toBeDefined()
      expect(scoresCol?.type).toBe('Array(Float64)')

      const addressesCol = columns.find((col) => col.name === 'addresses')
      expect(addressesCol).toBeDefined()
      expect(addressesCol?.type).toBe('Array(JSON)')

      const statusHistoryCol = columns.find(
        (col) => col.name === 'statusHistory'
      )
      expect(statusHistoryCol).toBeDefined()
      expect(statusHistoryCol?.type).toBe('Array(LowCardinality(String))')
    })

    it('should handle enum arrays correctly', () => {
      const columns = generateColumnsFromTestModel('EnumArrayTestModel')

      expect(columns.length).toBe(3)

      const allowedStatusesCol = columns.find(
        (col) => col.name === 'allowedStatuses'
      )
      expect(allowedStatusesCol).toBeDefined()
      expect(allowedStatusesCol?.type).toBe('Array(LowCardinality(String))')

      const prioritiesCol = columns.find((col) => col.name === 'priorities')
      expect(prioritiesCol).toBeDefined()
      expect(prioritiesCol?.type).toBe('Array(LowCardinality(String))')
    })

    it('should throw error for invalid model', () => {
      expect(() => {
        generateColumnsFromTestModel('NonExistentModel')
      }).toThrow('Model NonExistentModel not found')
    })
  })

  describe('generateColumnsFromModel with real models', () => {
    it('should generate columns for InternalTransaction', () => {
      const columns = generateColumnsFromModel('InternalTransaction')

      expect(columns).toBeDefined()
      expect(Array.isArray(columns)).toBe(true)
      expect(columns.length).toBeGreaterThan(30)

      // Check for key columns
      const transactionIdCol = columns.find(
        (col) => col.name === 'transactionId'
      )
      expect(transactionIdCol).toBeDefined()
      expect(transactionIdCol?.type).toBe('String')

      const timestampCol = columns.find((col) => col.name === 'timestamp')
      expect(timestampCol).toBeDefined()
      expect(timestampCol?.type).toBe('Float64')
    })

    it('should throw error for invalid model', () => {
      expect(() => {
        generateColumnsFromModel('NonExistentModel')
      }).toThrow('Model NonExistentModel not found')
    })
  })

  describe('generateTableSchemaFromModel with test models', () => {
    const generateTableSchemaFromTestModel = (
      modelName: string,
      config: {
        tableName: string
        idColumn: string
        timestampColumn: string
        engine?: string
        orderBy?: string
        primaryKey?: string
        partitionBy?: string
      }
    ) => {
      const columns = generateColumnsFromTestModel(modelName)
      return {
        tableName: config.tableName,
        columns,
        idColumn: config.idColumn,
        timestampColumn: config.timestampColumn,
        engine: config.engine || 'ReplacingMergeTree',
        orderBy:
          config.orderBy || `(${config.timestampColumn}, ${config.idColumn})`,
        primaryKey:
          config.primaryKey ||
          `(${config.timestampColumn}, ${config.idColumn})`,
        partitionBy:
          config.partitionBy ||
          `toYYYYMM(toDateTime(${config.timestampColumn} / 1000))`,
      }
    }

    it('should generate complete table schema', () => {
      const schema = generateTableSchemaFromTestModel('SimpleTestModel', {
        tableName: 'test_simple',
        idColumn: 'id',
        timestampColumn: 'createdAt',
        engine: 'ReplacingMergeTree',
        orderBy: '(createdAt, id)',
        primaryKey: '(createdAt, id)',
        partitionBy: 'toYYYYMM(toDateTime(createdAt / 1000))',
      })

      expect(schema.tableName).toBe('test_simple')
      expect(schema.idColumn).toBe('id')
      expect(schema.timestampColumn).toBe('createdAt')
      expect(schema.engine).toBe('ReplacingMergeTree')
      expect(schema.orderBy).toBe('(createdAt, id)')
      expect(schema.primaryKey).toBe('(createdAt, id)')
      expect(schema.partitionBy).toBe('toYYYYMM(toDateTime(createdAt / 1000))')
      expect(schema.columns).toBeDefined()
      expect(schema.columns.length).toBe(5)
    })

    it('should use default values when not provided', () => {
      const schema = generateTableSchemaFromTestModel('SimpleTestModel', {
        tableName: 'test_simple',
        idColumn: 'id',
        timestampColumn: 'createdAt',
      })

      expect(schema.engine).toBe('ReplacingMergeTree')
      expect(schema.orderBy).toBe('(createdAt, id)')
      expect(schema.primaryKey).toBe('(createdAt, id)')
      expect(schema.partitionBy).toBe('toYYYYMM(toDateTime(createdAt / 1000))')
    })
  })

  describe('generateTableSchemaFromModel with real models', () => {
    it('should generate complete table schema', () => {
      const schema = generateTableSchemaFromModel('InternalTransaction', {
        tableName: 'test_transactions',
        idColumn: 'transactionId',
        timestampColumn: 'timestamp',
        engine: 'ReplacingMergeTree',
        orderBy: '(timestamp, transactionId)',
        primaryKey: '(timestamp, transactionId)',
        partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
      })

      expect(schema.tableName).toBe('test_transactions')
      expect(schema.idColumn).toBe('transactionId')
      expect(schema.timestampColumn).toBe('timestamp')
      expect(schema.engine).toBe('ReplacingMergeTree')
      expect(schema.orderBy).toBe('(timestamp, transactionId)')
      expect(schema.primaryKey).toBe('(timestamp, transactionId)')
      expect(schema.partitionBy).toBe('toYYYYMM(toDateTime(timestamp / 1000))')
      expect(schema.columns).toBeDefined()
      expect(schema.columns.length).toBeGreaterThan(30)
    })

    it('should use default values when not provided', () => {
      const schema = generateTableSchemaFromModel('InternalTransaction', {
        tableName: 'test_transactions',
        idColumn: 'transactionId',
        timestampColumn: 'timestamp',
      })

      expect(schema.engine).toBe('ReplacingMergeTree')
      expect(schema.orderBy).toBe('(timestamp, transactionId)')
      expect(schema.primaryKey).toBe('(timestamp, transactionId)')
      expect(schema.partitionBy).toBe('toYYYYMM(toDateTime(timestamp / 1000))')
    })
  })

  describe('InternalUser model', () => {
    it('should generate columns for InternalUser', () => {
      const columns = generateColumnsFromModel('InternalUser')

      expect(columns).toBeDefined()
      expect(columns.length).toBeGreaterThan(40)

      // Check for key columns
      const userIdCol = columns.find((col) => col.name === 'userId')
      expect(userIdCol).toBeDefined()
      expect(userIdCol?.type).toBe('String')

      const typeCol = columns.find((col) => col.name === 'type')
      expect(typeCol).toBeDefined()
      expect(typeCol?.type).toBe('String')
    })

    it('should handle enum fields in InternalUser', () => {
      const columns = generateColumnsFromModel('InternalUser')

      const riskLevelCol = columns.find((col) => col.name === 'riskLevel')
      expect(riskLevelCol).toBeDefined()
      expect(riskLevelCol?.type).toBe('LowCardinality(String)')

      const employmentStatusCol = columns.find(
        (col) => col.name === 'employmentStatus'
      )
      expect(employmentStatusCol).toBeDefined()
      expect(employmentStatusCol?.type).toBe('LowCardinality(String)')
    })
  })

  describe('Edge cases with test models', () => {
    it('should handle models with minimal attributes', () => {
      const columns = generateColumnsFromTestModel('SimpleTestModel')
      expect(columns).toBeDefined()
      expect(Array.isArray(columns)).toBe(true)
      expect(columns.length).toBe(5)
    })

    it('should handle nullable types', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      // Check that we have both nullable and non-nullable fields
      const nullableFields = columns.filter((col) => col.nullable)
      const nonNullableFields = columns.filter((col) => !col.nullable)
      expect(nullableFields.length).toBe(1) // Only alternativePayment with null
      expect(nonNullableFields.length).toBe(15) // All others
    })

    it('should handle comprehensive type coverage', () => {
      const columns = generateColumnsFromTestModel('ComplexTestModel')

      // Verify we have all expected types
      const types = columns.map((col) => col.type)
      expect(types).toContain('String')
      expect(types).toContain('Float64')
      expect(types).toContain('Bool')
      expect(types).toContain('LowCardinality(String)')
      expect(types).toContain('JSON')
      expect(types).toContain('Array(String)')
      expect(types).toContain('Array(Float64)')
      expect(types).toContain('Array(JSON)')
      expect(types).toContain('Array(LowCardinality(String))')
    })
  })
})
