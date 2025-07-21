import { Readable } from 'stream'
import Ajv from 'ajv'
import { CsvFormat } from '../csv'
import { getS3Client } from '@/utils/s3'
import { EntityModel } from '@/@types/model'
import { generateJsonSchemaFromEntityClass } from '@/utils/json-schema'

// Mock the S3 client
jest.mock(
  '@/utils/s3',
  () => ({
    getS3Client: jest.fn(),
  }),
  { virtual: true }
)

describe('CsvFormat', () => {
  let csvFormat: CsvFormat
  const mockModel = {} as typeof EntityModel

  beforeEach(() => {
    csvFormat = new CsvFormat('tenantId', mockModel, 'test-file.csv')
    jest.clearAllMocks()
  })

  const ajv = new Ajv({
    coerceTypes: true,
    allErrors: true,
    removeAdditional: 'all',
    strict: true,
  })

  const parseRecordWithAJV = (
    record: Record<string, any>,
    model: typeof EntityModel
  ) => {
    const schema = generateJsonSchemaFromEntityClass(model)
    const validate = ajv.compile(schema)
    const valid = validate(record)
    return { valid, data: record }
  }

  describe('readAndParse', () => {
    const mockS3Key = 'test-file.csv'
    const mockBucket = 'test-bucket'

    beforeEach(() => {
      process.env.DOCUMENT_BUCKET = mockBucket
    })

    it('should successfully parse CSV data from S3', async () => {
      class Model extends EntityModel {
        static readonly attributeTypeMap = [
          { name: 'name', baseName: 'name', type: 'string', format: '' },
          { name: 'age', baseName: 'age', type: 'number', format: '' },
        ]
      }
      // Mock CSV data
      const csvData = 'name,age\nJohn,30\nJane,25'
      const mockStream = new Readable()
      mockStream.push(csvData)
      mockStream.push(null)

      // Mock S3 response
      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: mockStream }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      const records: any[] = []
      for await (const record of csvFormat.readAndParse(mockS3Key)) {
        const result = parseRecordWithAJV(record.record, Model)
        expect(result.valid).toBe(true)
        records.push({ ...record, record: result.data })
      }

      // Verify S3 client was called correctly
      expect(getS3Client).toHaveBeenCalled()
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: mockBucket,
            Key: mockS3Key,
          },
        })
      )

      // Verify parsed records
      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({
        index: 0,
        record: { name: 'John', age: 30 },
      })
      expect(records[1]).toEqual({
        index: 1,
        record: { name: 'Jane', age: 25 },
      })
    })

    it('should correctly parse datatypes from S3', async () => {
      class Model extends EntityModel {
        static readonly attributeTypeMap = [
          { name: 'name', baseName: 'name', type: 'string', format: '' },
          {
            name: 'telephone',
            baseName: 'telephone',
            type: 'string',
            format: '',
          },
          {
            name: 'age',
            baseName: 'age',
            type: 'number',
            format: '',
          },
          {
            name: 'isActive',
            baseName: 'isActive',
            type: 'boolean',
            format: '',
          },
          {
            name: 'address',
            baseName: 'address',
            type: 'string',
            format: '',
          },
          {
            name: 'amount',
            baseName: 'amount',
            type: 'number',
            format: '',
          },
        ]
      }
      // Mock CSV data
      const csvData =
        'name,telephone,age,isActive,address,amount\n"John,Wilson",1234567890,"31","true","123 Main St",100.01\nJane,0987654321,32,false,"456 Main St",200.02'
      const mockStream = new Readable()
      mockStream.push(csvData)
      mockStream.push(null)

      // Mock S3 response
      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: mockStream }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      const records: object[] = []
      for await (const record of csvFormat.readAndParse(mockS3Key)) {
        const result = parseRecordWithAJV(record.record, Model)
        console.log(result)
        expect(result.valid).toBe(true)
        records.push({ ...record, record: result.data })
      }

      // Verify S3 client was called correctly
      expect(getS3Client).toHaveBeenCalled()
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: mockBucket,
            Key: mockS3Key,
          },
        })
      )

      // Verify parsed records
      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({
        index: 0,
        record: {
          name: 'John,Wilson',
          telephone: '1234567890',
          age: 31,
          isActive: true,
          address: '123 Main St',
          amount: 100.01,
        },
      })
      expect(records[1]).toEqual({
        index: 1,
        record: {
          name: 'Jane',
          telephone: '0987654321',
          age: 32,
          isActive: false,
          address: '456 Main St',
          amount: 200.02,
        },
      })
    })

    it('should throw error if S3 body is not a Readable stream', async () => {
      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: 'not-a-stream' }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      await expect(async () => {
        for await (const _ of csvFormat.readAndParse(mockS3Key)) {
          // This should throw before we get here
        }
      }).rejects.toThrow('Expected Body to be a Node.js Readable stream')
    })

    it('should handle empty CSV file', async () => {
      const mockStream = new Readable()
      mockStream.push('')
      mockStream.push(null)

      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: mockStream }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      const records: any[] = []
      for await (const record of csvFormat.readAndParse(mockS3Key)) {
        records.push(record)
      }

      expect(records).toHaveLength(0)
    })

    it('should handle CSV with missing columns', async () => {
      class Model extends EntityModel {
        static readonly attributeTypeMap = [
          { name: 'name', baseName: 'name', type: 'string', format: '' },
          {
            name: 'age',
            baseName: 'age',
            type: 'number',
            format: '',
          },
        ]
      }
      const csvData = 'name,age\nJohn\nJane,25'
      const mockStream = new Readable()
      mockStream.push(csvData)
      mockStream.push(null)

      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: mockStream }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      const records: any[] = []
      for await (const record of csvFormat.readAndParse(mockS3Key)) {
        const result = parseRecordWithAJV(record.record, Model)
        expect(result.valid).toBe(true)
        records.push({ ...record, record: result.data })
      }

      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({
        index: 0,
        record: { name: 'John', age: undefined },
      })
      expect(records[1]).toEqual({
        index: 1,
        record: { name: 'Jane', age: 25 },
      })
    })

    it('should handle CSV with nested arrays', async () => {
      const csvData = 'name,children.0.name,children.1.name\nJohn,Jane,Mike'
      const mockStream = new Readable()
      mockStream.push(csvData)
      mockStream.push(null)

      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Body: mockStream }),
      }
      ;(getS3Client as jest.Mock).mockReturnValue(mockS3Client)

      const records: any[] = []
      for await (const record of csvFormat.readAndParse(mockS3Key)) {
        records.push(record)
      }

      expect(records).toHaveLength(1)
      expect(records[0]).toEqual({
        index: 0,
        record: {
          name: 'John',
          children: [{ name: 'Jane' }, { name: 'Mike' }],
        },
      })
    })
  })
})
