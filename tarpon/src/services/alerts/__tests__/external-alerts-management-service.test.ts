import { ExternalAlertManagementService } from '../external-alerts-management-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { CaseRepository } from '@/services/cases/repository'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import { AlertCreationRequest } from '@/@types/openapi-public-management/AlertCreationRequest'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { AlertUpdatable } from '@/@types/openapi-public-management/AlertUpdatable'
import { getS3ClientByEvent } from '@/utils/s3'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'

dynamoDbSetupHook()
withLocalChangeHandler()

describe('End to End External Alerts Management Service', () => {
  const tenantId = getTestTenantId()
  const transactionIds = Array.from({ length: 20 }, (_, i) => `T-${i}`)

  setUpTransactionsHooks(
    tenantId,
    transactionIds.map((id) =>
      getTestTransaction({
        transactionId: id,
        tags: [{ key: 'transactionId', value: id }],
      })
    )
  )

  test('should make successful call to create, update and get alerts', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const s3 = getS3ClientByEvent(null as any)

    const alertsExternalService = new ExternalAlertManagementService(
      tenantId,
      { mongoDb, dynamoDb },
      s3,
      { documentBucketName: 'test-bucket', tmpBucketName: 'test-bucket' }
    )

    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )
    const caseId = 'C-1234'
    const alertId = 'AL-1234'

    await caseRepository.addCaseMongo({
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      caseType: 'SYSTEM',
      caseId,
      caseSubjectIdentifiers: ['S-1'],
    })
    const alertTransactionIds = transactionIds.slice(0, 5)

    const alertCreationRequest: AlertCreationRequest = {
      caseId,
      alertId,
      createdTimestamp: Date.now(),
      priority: 'P1',
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: alertTransactionIds,
      },
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1234',
        instanceId: 'I-1234',
        name: 'Allow all transactions',
      },
    }

    const alert = (
      await alertsExternalService.createAlert(alertCreationRequest)
    ).result
    expect(alert).toEqual({
      alertId: 'AL-1234',
      alertStatus: 'OPEN',
      caseId: 'C-1234',
      createdTimestamp: expect.any(Number),
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: ['T-0', 'T-1', 'T-2', 'T-3', 'T-4'],
      },
      priority: 'P1',
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1234',
        instanceId: 'I-1234',
        name: 'Allow all transactions',
      },
      updatedAt: expect.any(Number),
      assignments: [],
    })

    const transactions = await transactionRepository.getTransactionsByIds(
      alertTransactionIds
    )

    transactions.forEach((transaction) => {
      expect(transaction.alertIds).toContain(alertId)
    })

    const case1 = await caseRepository.getCaseById(alert.caseId, true)

    expect(case1).toMatchObject({
      caseAggregates: {
        originPaymentMethods: ['CARD'],
        destinationPaymentMethods: ['CARD'],
        tags: expect.arrayContaining([
          { value: 'T-0', key: 'transactionId' },
          { value: 'T-2', key: 'transactionId' },
          { value: 'T-3', key: 'transactionId' },
          { value: 'T-4', key: 'transactionId' },
          { value: 'T-1', key: 'transactionId' },
        ]),
      },
      caseType: 'SYSTEM',
      caseId: 'C-1234',
      alerts: [
        {
          alertId: 'AL-1234',
          createdTimestamp: expect.any(Number),
          caseId: 'C-1234',
          priority: 'P1',
          numberOfTransactionsHit: 5,
          ruleAction: 'ALLOW',
          ruleDescription: 'Allow all transactions',
          ruleInstanceId: 'I-1234',
          ruleName: 'Allow all transactions',
          alertStatus: 'OPEN',
          creationReason: null,
          assignments: [],
          transactionIds: ['T-0', 'T-1', 'T-2', 'T-3', 'T-4'],
          ruleId: 'R-1234',
          tags: null,
          updatedAt: expect.any(Number),
          ruleNature: null,
          originPaymentMethods: ['CARD'],
          destinationPaymentMethods: ['CARD'],
          createdTimestampInternal: expect.any(Number),
        },
      ],
      caseTransactionsCount: 5,
      caseTransactionsIds: ['T-0', 'T-1', 'T-2', 'T-3', 'T-4'],
      updatedAt: expect.any(Number),
    })

    const alertId2 = 'AL-1235'

    const alertsExternalService2 = new ExternalAlertManagementService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      { documentBucketName: 'test-bucket', tmpBucketName: 'test-bucket' }
    )

    const alertTransactionIds2 = transactionIds.slice(2, 8)
    const alertCreationRequest2: AlertCreationRequest = {
      caseId,
      alertId: alertId2,
      createdTimestamp: Date.now(),
      priority: 'P1',
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: alertTransactionIds2,
      },
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1234',
        instanceId: 'I-1234',
        name: 'Allow all transactions',
      },
    }

    await alertsExternalService2.createAlert(alertCreationRequest2)

    const case2 = await caseRepository.getCaseById(alert.caseId, true)

    const transactions2 = await transactionRepository.getTransactionsByIds(
      alertTransactionIds2
    )
    transactions2.forEach((transaction) => {
      expect(transaction.alertIds).toContain(alertId2)
    })

    expect(case2).toMatchObject({
      caseAggregates: {
        originPaymentMethods: ['CARD'],
        destinationPaymentMethods: ['CARD'],
        tags: expect.arrayContaining([
          { value: 'T-0', key: 'transactionId' },
          { value: 'T-2', key: 'transactionId' },
          { value: 'T-3', key: 'transactionId' },
          { value: 'T-4', key: 'transactionId' },
          { value: 'T-1', key: 'transactionId' },
          { value: 'T-5', key: 'transactionId' },
          { value: 'T-6', key: 'transactionId' },
          { value: 'T-7', key: 'transactionId' },
        ]),
      },
      caseType: 'SYSTEM',
      caseTransactionsIds: [
        'T-0',
        'T-1',
        'T-2',
        'T-3',
        'T-4',
        'T-5',
        'T-6',
        'T-7',
      ],
    })

    const alertsExternalService3 = new ExternalAlertManagementService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      { documentBucketName: 'test-bucket', tmpBucketName: 'test-bucket' }
    )
    // Replace transactions of alert 1 from 2 - 6

    const updateAlertTransactionIds = transactionIds.slice(2, 7)

    const alertUpdateRequest: AlertUpdatable = {
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: transactionIds.slice(2, 7),
      },
    }

    await alertsExternalService3.updateAlert(alertId, alertUpdateRequest)

    const transactions3 = await transactionRepository.getTransactionsByIds(
      updateAlertTransactionIds
    )
    const removedTransactions =
      await transactionRepository.getTransactionsByIds(
        transactionIds.slice(0, 2)
      )

    transactions3.forEach((transaction) => {
      expect(transaction.alertIds).toContain(alertId)
    })

    removedTransactions.forEach((transaction) => {
      expect(transaction.alertIds).not.toContain(alertId)
    })

    const case3 = await caseRepository.getCaseById(alert.caseId, true)

    expect(case3?.caseTransactionsIds).toEqual(
      expect.arrayContaining(['T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7'])
    )

    expect(case3?.caseAggregates?.tags).toEqual(
      expect.arrayContaining([
        { value: 'T-2', key: 'transactionId' },
        { value: 'T-3', key: 'transactionId' },
        { value: 'T-4', key: 'transactionId' },
        { value: 'T-5', key: 'transactionId' },
        { value: 'T-6', key: 'transactionId' },
        { value: 'T-7', key: 'transactionId' },
      ])
    )
  })

  test('Alert Id more the 40 characters should throw error', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const s3 = getS3ClientByEvent(null as any)
    const alertsExternalService = new ExternalAlertManagementService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      { documentBucketName: 'test-bucket', tmpBucketName: 'test-bucket' }
    )

    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const caseId = 'C-1234'
    const alertId = `AL-${'1'.repeat(38)}`

    await caseRepository.addCaseMongo({
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      caseType: 'SYSTEM',
      caseId,
    })

    const alertCreationRequest: AlertCreationRequest = {
      caseId,
      alertId,
      createdTimestamp: Date.now(),
      priority: 'P1',
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: transactionIds.slice(0, 5),
      },
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1234',
        instanceId: 'I-1234',
        name: 'Allow all transactions',
      },
    }

    await expect(
      alertsExternalService.createAlert(alertCreationRequest)
    ).rejects.toThrow(
      'Alert id: AL-11111111111111111111111111111111111111 is too long. We only support alert ids upto 40 characters'
    )
  })

  test('Alert id with A-<number> should throw error', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const s3 = getS3ClientByEvent(null as any)
    const alertsExternalService = new ExternalAlertManagementService(
      tenantId,
      {
        mongoDb,
        dynamoDb,
      },
      s3,
      { documentBucketName: 'test-bucket', tmpBucketName: 'test-bucket' }
    )

    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const caseId = 'C-1234'
    const alertId = 'A-1234'

    await caseRepository.addCaseMongo({
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      caseType: 'SYSTEM',
      caseId,
    })

    const alertCreationRequest: AlertCreationRequest = {
      caseId,
      alertId,
      createdTimestamp: Date.now(),
      priority: 'P1',
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: transactionIds.slice(0, 5),
      },
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1234',
        instanceId: 'I-1234',
        name: 'Allow all transactions',
      },
    }

    await expect(
      alertsExternalService.createAlert(alertCreationRequest)
    ).rejects.toThrow(
      'Alert id: A-1234 not allowed for creation reserving A-{number} for internal alerts'
    )
  })
})
