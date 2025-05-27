import { FlatFilesService } from '..'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'

// Mock dependencies
jest.mock('@/utils/clickhouse/utils', () => ({
  getClickhouseClient: jest.fn().mockResolvedValue({}),
  getClickhouseCredentials: jest.fn().mockResolvedValue({
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'test',
  }),
}))

jest.mock('@/utils/dynamodb', () => ({
  getDynamoDbClient: jest.fn().mockReturnValue({}),
}))

jest.mock('@/utils/mongodb-utils', () => ({
  getMongoDbClient: jest.fn().mockResolvedValue({}),
}))

describe('FlatFilesService', () => {
  const TEST_TENANT_ID = 'test-tenant'
  let service: FlatFilesService

  beforeEach(() => {
    service = new FlatFilesService(TEST_TENANT_ID)
    jest.clearAllMocks()
  })

  describe('generateTemplate', () => {
    it('should generate CSV template for BULK_CASE_CLOSURE schema', async () => {
      const template = await service.generateTemplate(
        'BULK_CASE_CLOSURE',
        'CSV'
      )

      expect(template).toBeDefined()
      expect(template.keys).toBeInstanceOf(Array)
      expect(template.fileString).toBeDefined()

      if (!template.fileString) {
        throw new Error('Template fileString is undefined')
      }

      expect(template.fileString).toContain('\n')

      // Verify that the template contains expected headers from CaseClosure model
      const headers = template.fileString.split('\n')[0].split(',')
      expect(headers.length).toBeGreaterThan(0)
    })

    it('should throw error for unsupported format', async () => {
      const unsupportedFormat = 'UNSUPPORTED' as FlatFileTemplateFormat

      await expect(
        service.generateTemplate('BULK_CASE_CLOSURE', unsupportedFormat)
      ).rejects.toThrow(
        `Unsupported format '${unsupportedFormat}' for tenant ${TEST_TENANT_ID}`
      )
    })

    it('should use correct model for BULK_CASE_CLOSURE schema', async () => {
      const template = await service.generateTemplate(
        'BULK_CASE_CLOSURE',
        'CSV'
      )

      // Verify that the template contains headers that match CaseClosure model structure
      if (!template.fileString) {
        throw new Error('Template fileString is undefined')
      }

      const headers = template.fileString.split('\n')[0].split(',')

      // Add specific assertions based on CaseClosure model structure
      // This is a basic example - you should add more specific assertions based on your actual model
      expect(headers).toContain('caseId')
    })
  })
})
