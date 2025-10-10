import { BatchImportService } from '../index'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  createTransaction,
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { enableLocalChangeHandler } from '@/utils/local-change-handler'
import {
  getTestBusinessEvent,
  getTestUserEvent,
} from '@/test-utils/user-event-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

enableLocalChangeHandler()
dynamoDbSetupHook()

describe('BatchImportService', () => {
  const TEST_TENANT_ID = getTestTenantId()
  let batchImportService: BatchImportService

  beforeAll(async () => {
    batchImportService = new BatchImportService(TEST_TENANT_ID, {
      dynamoDb: getDynamoDbClient(),
      mongoDb: await getMongoDbClient(),
    })
  })

  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: 'U-1' }),
    getTestUser({ userId: 'U-2' }),
  ])
  describe('importTransactions', () => {
    it('success', async () => {
      const { response } = await batchImportService.importTransactions(
        'test-batch-id',
        [
          getTestTransaction({
            originUserId: 'U-1',
            destinationUserId: 'U-2',
          }),
          getTestTransaction({
            originUserId: 'U-2',
            destinationUserId: 'U-1',
          }),
        ],
        { validateOriginUserId: true, validateDestinationUserId: true }
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })

    it('success (without user validation)', async () => {
      const { response } = await batchImportService.importTransactions(
        'test-batch-id',
        [
          getTestTransaction({
            originUserId: 'ghost-1',
            destinationUserId: 'ghost-2',
          }),
          getTestTransaction({
            originUserId: 'ghost-1',
            destinationUserId: 'ghost-2',
          }),
        ]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const testTransaction1 = getTestTransaction({
        originUserId: 'U-1',
        destinationUserId: 'U-2',
      })
      const testTransaction2 = getTestTransaction({
        originUserId: 'U-3',
        destinationUserId: 'U-1',
      })
      const { response } = await batchImportService.importTransactions(
        'test-batch-id',
        [testTransaction1, testTransaction2],
        { validateOriginUserId: true, validateDestinationUserId: true }
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: testTransaction2.transactionId,
            reasonCode: 'ORIGIN_USER_ID_NOT_FOUND',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })

    it('all failure', async () => {
      const testTransaction1 = getTestTransaction({
        originUserId: 'U-3',
        destinationUserId: 'U-4',
      })
      const testTransaction2 = getTestTransaction({
        originUserId: 'U-1',
        destinationUserId: 'U-2',
        relatedTransactionIds: ['unknown-transaction-id'],
      })
      const { response } = await batchImportService.importTransactions(
        'test-batch-id',
        [testTransaction1, testTransaction2],
        { validateOriginUserId: true, validateDestinationUserId: true }
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: testTransaction1.transactionId,
            reasonCode: 'ORIGIN_USER_ID_NOT_FOUND',
          },
          {
            id: testTransaction2.transactionId,
            reasonCode: 'RELATED_ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
  describe('importTransactionEvents', () => {
    it('success', async () => {
      await createTransaction(
        TEST_TENANT_ID,
        getTestTransaction({ transactionId: 'T-1' })
      )
      await createTransaction(
        TEST_TENANT_ID,
        getTestTransaction({ transactionId: 'T-2' })
      )
      const { response } = await batchImportService.importTransactionEvents(
        'test-batch-id',
        [
          getTestTransactionEvent({ transactionId: 'T-1' }),
          getTestTransactionEvent({ transactionId: 'T-2' }),
        ]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const { response } = await batchImportService.importTransactionEvents(
        'test-batch-id',
        [
          getTestTransactionEvent({
            eventId: 'E-1',
            transactionId: 'T-unknown',
          }),
          getTestTransactionEvent({ eventId: 'E-2', transactionId: 'T-2' }),
        ]
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: 'T-unknown',
            reasonCode: 'ID_NOT_FOUND',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })
    it('all failure', async () => {
      const { response } = await batchImportService.importTransactionEvents(
        'test-batch-id',
        [
          getTestTransactionEvent({
            eventId: 'E-1',
            transactionId: 'T-unknown',
          }),
          getTestTransactionEvent({
            eventId: 'E-2',
            transactionId: 'T-unknown',
          }),
        ]
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: 'T-unknown',
            reasonCode: 'ID_NOT_FOUND',
          },
          {
            id: 'T-unknown',
            reasonCode: 'ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
  describe('importConsumerUsers', () => {
    it('success', async () => {
      const { response } = await batchImportService.importConsumerUsers(
        'test-batch-id',
        [getTestUser({ userId: 'U-3' }), getTestUser({ userId: 'U-4' })]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const { response } = await batchImportService.importConsumerUsers(
        'test-batch-id',
        [getTestUser({ userId: 'U-1' }), getTestUser({ userId: 'U-4' })]
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: 'U-1',
            reasonCode: 'ID_ALREADY_EXISTS',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })
    it('all failure', async () => {
      const { response } = await batchImportService.importConsumerUsers(
        'test-batch-id',
        [
          getTestUser({ userId: 'U-1' }),
          getTestUser({
            userId: 'U-new-1',
            linkedEntities: { parentUserId: 'U-new-2' },
          }),
        ]
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: 'U-1',
            reasonCode: 'ID_ALREADY_EXISTS',
          },
          {
            id: 'U-new-1',
            reasonCode: 'RELATED_ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
  describe('importConsumerUserEvents', () => {
    it('success', async () => {
      const { response } = await batchImportService.importConsumerUserEvents(
        'test-batch-id',
        [
          getTestUserEvent({ userId: 'U-1' }),
          getTestUserEvent({ userId: 'U-2' }),
        ]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const { response } = await batchImportService.importConsumerUserEvents(
        'test-batch-id',
        [
          getTestUserEvent({ eventId: 'E-1', userId: 'U-1' }),
          getTestUserEvent({ eventId: 'E-2', userId: 'U-4' }),
        ]
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: 'U-4',
            reasonCode: 'ID_NOT_FOUND',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })
    it('all failure', async () => {
      const { response } = await batchImportService.importConsumerUserEvents(
        'test-batch-id',
        [
          getTestUserEvent({ eventId: 'E-1', userId: 'U-unknown-1' }),
          getTestUserEvent({
            eventId: 'E-2',
            userId: 'U-1',
            updatedConsumerUserAttributes: {
              linkedEntities: { parentUserId: 'U-unknown-2' },
            },
          }),
        ]
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: 'U-unknown-1',
            reasonCode: 'ID_NOT_FOUND',
          },
          {
            id: 'E-2',
            reasonCode: 'RELATED_ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
  describe('importBusinessUsers', () => {
    it('success', async () => {
      const { response } = await batchImportService.importBusinessUsers(
        'test-batch-id',
        [getTestBusiness({ userId: 'U-3' }), getTestBusiness({ userId: 'U-4' })]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const { response } = await batchImportService.importBusinessUsers(
        'test-batch-id',
        [getTestBusiness({ userId: 'U-1' }), getTestBusiness({ userId: 'U-4' })]
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: 'U-1',
            reasonCode: 'ID_ALREADY_EXISTS',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })
    it('all failure', async () => {
      const { response } = await batchImportService.importBusinessUsers(
        'test-batch-id',
        [
          getTestBusiness({ userId: 'U-1' }),
          getTestBusiness({
            userId: 'U-new-1',
            linkedEntities: { parentUserId: 'U-new-2' },
          }),
        ]
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: 'U-1',
            reasonCode: 'ID_ALREADY_EXISTS',
          },
          {
            id: 'U-new-1',
            reasonCode: 'RELATED_ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
  describe('importBusinessUserEvents', () => {
    it('success', async () => {
      const { response } = await batchImportService.importBusinessUserEvents(
        'test-batch-id',
        [
          getTestUserEvent({ userId: 'U-1' }),
          getTestUserEvent({ userId: 'U-2' }),
        ]
      )
      expect(response).toEqual({
        status: 'SUCCESS',
        batchId: 'test-batch-id',
        successful: 2,
        failed: 0,
      })
    })
    it('partial failure', async () => {
      const { response } = await batchImportService.importBusinessUserEvents(
        'test-batch-id',
        [
          getTestBusinessEvent({ eventId: 'E-1', userId: 'U-1' }),
          getTestBusinessEvent({ eventId: 'E-2', userId: 'U-4' }),
        ]
      )
      expect(response).toEqual({
        status: 'PARTIAL_FAILURE',
        batchId: 'test-batch-id',
        successful: 1,
        failed: 1,
        failedRecords: [
          {
            id: 'U-4',
            reasonCode: 'ID_NOT_FOUND',
          },
        ],
        message: '1 of 2 records failed validation',
      })
    })
    it('all failure', async () => {
      const { response } = await batchImportService.importBusinessUserEvents(
        'test-batch-id',
        [
          getTestBusinessEvent({ eventId: 'E-1', userId: 'U-unknown-1' }),
          getTestBusinessEvent({
            eventId: 'E-2',
            userId: 'U-1',
            updatedBusinessUserAttributes: {
              linkedEntities: { parentUserId: 'U-unknown-2' },
            },
          }),
        ]
      )
      expect(response).toEqual({
        status: 'FAILURE',
        batchId: 'test-batch-id',
        successful: 0,
        failed: 2,
        failedRecords: [
          {
            id: 'U-unknown-1',
            reasonCode: 'ID_NOT_FOUND',
          },
          {
            id: 'E-2',
            reasonCode: 'RELATED_ID_NOT_FOUND',
          },
        ],
        message: '2 of 2 records failed validation',
      })
    })
  })
})
