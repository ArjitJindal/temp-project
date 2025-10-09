import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoDbTransactionRepository } from '../mongodb-transaction-repository'
import { TimeRange } from '../transaction-repository-interface'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongo-table-names'

describe('MongoDbTransactionRepository - getUniqueAddressDetails', () => {
  let repository: MongoDbTransactionRepository
  let mongoClient: MongoClient
  let testTenantId: string

  beforeEach(async () => {
    testTenantId = getTestTenantId()
    const mockDynamoDb = {} as DynamoDBDocumentClient
    mongoClient = await getMongoDbClient()
    repository = new MongoDbTransactionRepository(
      testTenantId,
      mongoClient,
      mockDynamoDb
    )

    // Clean up any existing test data
    const db = mongoClient.db()
    const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))
    await collection.deleteMany({})
  })

  afterEach(async () => {
    // Clean up test data
    const db = mongoClient.db()
    const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))
    await collection.deleteMany({})
  })

  describe('getUniqueAddressDetails', () => {
    const timeRange: TimeRange = {
      afterTimestamp: 1000000000,
      beforeTimestamp: 2000000000,
    }

    it('should return unique addresses for payment methods with address fields', async () => {
      // Add test transactions to the database
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000, // Within time range
          originPaymentDetails: {
            method: 'CARD',
            address: {
              addressLines: ['123 Main St', 'Apt 4B'],
              postcode: '12345',
              city: 'New York',
              state: 'NY',
              country: 'USA',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            address: {
              addressLines: ['456 Oak Ave'],
              postcode: '67890',
              city: 'Los Angeles',
              state: 'CA',
              country: 'USA',
            },
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(2)
      expect(result).toContainEqual({
        addressLines: ['123 Main St', 'Apt 4B'],
        postcode: '12345',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      })
      expect(result).toContainEqual({
        addressLines: ['456 Oak Ave'],
        postcode: '67890',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
      })
    })

    it('should handle addresses with missing fields', async () => {
      // Add test transaction with missing fields
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        originPaymentDetails: {
          method: 'CARD',
          address: {
            addressLines: ['789 Pine St'],
            // postcode is missing
            city: 'Chicago',
            // state is missing
            country: 'USA',
          },
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        addressLines: ['789 Pine St'],
        city: 'Chicago',
        country: 'USA',
      })
    })

    it('should filter out addresses with empty addressLines', async () => {
      // Add test transactions with various address line scenarios
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            address: {
              addressLines: [], // empty addressLines - should be filtered out
              postcode: '12345',
              city: 'New York',
              state: 'NY',
              country: 'USA',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            address: {
              // addressLines field is missing - should be filtered out
              postcode: '67890',
              city: 'Los Angeles',
              state: 'CA',
              country: 'USA',
            } as any,
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            address: {
              addressLines: ['Valid Address'], // valid addressLines
              postcode: '11111',
              city: 'Boston',
              state: 'MA',
              country: 'USA',
            },
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        addressLines: ['Valid Address'],
        postcode: '11111',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
      })
    })

    it('should handle empty results', async () => {
      // No test data inserted, so should return empty results
      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(0)
    })

    it('should handle different payment methods with different address fields', async () => {
      // Add test transactions with different payment methods
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            address: {
              addressLines: ['Card Address'],
              city: 'Card City',
              country: 'Card Country',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'IBAN',
            bankAddress: {
              addressLines: ['Bank Address'],
              city: 'Bank City',
              country: 'Bank Country',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CHECK',
            shippingAddress: {
              addressLines: ['Shipping Address'],
              city: 'Shipping City',
              country: 'Shipping Country',
            },
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(3)
      expect(
        result.some((addr) => addr.addressLines[0] === 'Card Address')
      ).toBe(true)
      expect(
        result.some((addr) => addr.addressLines[0] === 'Bank Address')
      ).toBe(true)
      expect(
        result.some((addr) => addr.addressLines[0] === 'Shipping Address')
      ).toBe(true)
    })

    it('should handle DESTINATION direction', async () => {
      // Add test transaction with destination payment details
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        destinationPaymentDetails: {
          method: 'CARD',
          address: {
            addressLines: ['Destination Address'],
            city: 'Destination City',
            country: 'Destination Country',
          },
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueAddressDetails(
        'DESTINATION',
        timeRange
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        addressLines: ['Destination Address'],
        city: 'Destination City',
        country: 'Destination Country',
      })
    })

    it('should handle null and undefined values in address data', async () => {
      // Add test transaction with null/undefined values
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        originPaymentDetails: {
          method: 'CARD',
          address: {
            addressLines: ['Valid Street'],
            // postcode is null/undefined
            // city is null/undefined
            state: 'State',
            // country is null/undefined
          },
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueAddressDetails(
        'ORIGIN',
        timeRange
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        addressLines: ['Valid Street'],
        state: 'State',
      })
    })
  })

  describe('getUniqueNameDetails', () => {
    const timeRange: TimeRange = {
      afterTimestamp: 1000000000,
      beforeTimestamp: 2000000000,
    }

    it('should return unique names for payment methods with string names', async () => {
      // Add test transactions with string names
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CASH',
            name: 'John Doe',
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'WALLET',
            name: 'Jane Smith',
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(2)
      expect(result).toContain('John Doe')
      expect(result).toContain('Jane Smith')
    })

    it('should return unique names for payment methods with ConsumerName objects', async () => {
      // Add test transactions with ConsumerName objects
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'John',
              lastName: 'Doe',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Jane',
              middleName: 'Elizabeth',
              lastName: 'Smith',
            },
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(2)
      expect(
        result.some(
          (name) =>
            typeof name === 'object' &&
            name.firstName === 'John' &&
            name.lastName === 'Doe'
        )
      ).toBe(true)
      expect(
        result.some(
          (name) =>
            typeof name === 'object' &&
            name.firstName === 'Jane' &&
            name.middleName === 'Elizabeth' &&
            name.lastName === 'Smith'
        )
      ).toBe(true)
    })

    it('should handle mixed string and object names', async () => {
      // Add test transactions with mixed name types
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CASH',
            name: 'String Name',
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Object',
              lastName: 'Name',
            },
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(2)
      expect(result).toContain('String Name')
      expect(
        result.some(
          (name) =>
            typeof name === 'object' &&
            name.firstName === 'Object' &&
            name.lastName === 'Name'
        )
      ).toBe(true)
    })

    it('should filter out names without required firstName', async () => {
      // Add test transaction with incomplete ConsumerName
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            // firstName is missing - should be filtered out
            lastName: 'Doe',
          } as any,
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(0)
    })

    it('should handle DESTINATION direction', async () => {
      // Add test transaction with destination payment details
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        destinationPaymentDetails: {
          method: 'CASH',
          name: 'Destination Name',
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueNameDetails(
        'DESTINATION',
        timeRange
      )

      expect(result).toHaveLength(1)
      expect(result).toContain('Destination Name')
    })

    it('should handle different payment method name fields', async () => {
      // Add test transactions with different payment methods
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transactions: Partial<InternalTransaction>[] = [
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CASH',
            name: 'Cash Name',
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Card',
              lastName: 'Name',
            },
          },
        },
        {
          timestamp: 1500000000,
          originPaymentDetails: {
            method: 'IBAN',
            name: 'IBAN Name',
          },
        },
      ]

      await collection.insertMany(transactions)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(3)
      expect(result).toContain('Cash Name')
      expect(result).toContain('IBAN Name')
      expect(
        result.some(
          (name) =>
            typeof name === 'object' &&
            name.firstName === 'Card' &&
            name.lastName === 'Name'
        )
      ).toBe(true)
    })

    it('should handle empty results', async () => {
      // No test data inserted, so should return empty results
      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(0)
    })

    it('should handle null and undefined name values', async () => {
      // Add test transaction with null name
      const db = mongoClient.db()
      const collection = db.collection(TRANSACTIONS_COLLECTION(testTenantId))

      const transaction: Partial<InternalTransaction> = {
        timestamp: 1500000000,
        originPaymentDetails: {
          method: 'CASH',
          name: null as any,
        },
      }

      await collection.insertOne(transaction)

      const result = await repository.getUniqueNameDetails('ORIGIN', timeRange)

      expect(result).toHaveLength(0)
    })
  })
})
