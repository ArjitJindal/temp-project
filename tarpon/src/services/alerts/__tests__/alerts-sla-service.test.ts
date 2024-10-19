import { AlertsSLAService } from '../alerts-sla-service'
import {
  getTestAlert,
  getTestPolicy,
  setUpSLAHooks,
} from '../sla/sla-test-utils'
import { AlertsRepository } from '../repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Alert } from '@/@types/openapi-internal/Alert'
import { CaseRepository } from '@/services/cases/repository'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

withFeatureHook(['ALERT_SLA'])

jest.mock('../../accounts', () => {
  return {
    AccountsService: jest.fn().mockImplementation(() => {
      return {
        getAccount: jest.fn().mockImplementation(() => {
          return {
            role: 'test',
          }
        }),
      }
    }),
  }
})

describe('test sla service', () => {
  const tenantId = getTestTenantId()
  describe('test calculateSLAStatusForAlert', () => {
    describe('basic SLA calculation logic test', () => {
      const TEST_POLICY = getTestPolicy({
        id: 'test-policy-1',
      })
      setUpSLAHooks(tenantId, [TEST_POLICY])
      test('should return the Ok status and time for open alert with 10 day SLA', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-02T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-1'
        )
        expect(result).toEqual({
          elapsedTime: 86400000,
          policyStatus: 'OK',
        })
      })
      test('should return the Warning status and time for open alert with 10 day SLA', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-08T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-1'
        )
        expect(result).toEqual({
          elapsedTime: 604800000,
          policyStatus: 'WARNING',
        })
      })
      test('should return the Breached and time for open alert with 10 day SLA', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-11T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-1'
        )
        expect(result).toEqual({
          elapsedTime: 864000000,
          policyStatus: 'BREACHED',
        })
      })
    })
    describe('test SLA calculation with different status changes', () => {
      const TEST_POLICY = getTestPolicy({
        id: 'test-policy-2',
        policyConfiguration: {
          accountRoles: ['test'],
          alertStatusDetails: {
            alertStatuses: ['OPEN', 'IN_REVIEW'],
            alertStatusesCount: [
              { status: 'OPEN', count: 1, operator: 'EQ' },
              { status: 'IN_REVIEW', count: 1, operator: 'GTE' },
            ],
          },
          SLATime: {
            breachTime: {
              units: 10,
              granularity: 'days',
            },
            warningTime: {
              units: 5,
              granularity: 'days',
            },
          },
          workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        },
      })
      setUpSLAHooks(tenantId, [TEST_POLICY])
      test('should return the Ok status with second open status time skipped', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'IN_REVIEW_CLOSED',
              timestamp: new Date('2021-01-02T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'OPEN',
              timestamp: new Date('2021-01-03T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'IN_REVIEW_CLOSED',
              timestamp: new Date('2021-01-19T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-20T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-2'
        )
        expect(result).toEqual({
          elapsedTime: 259200000,
          policyStatus: 'OK',
        })
      })
      test('should return the Breached status with second open status time skipped', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'IN_REVIEW_CLOSED',
              timestamp: new Date('2021-01-02T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'OPEN',
              timestamp: new Date('2021-01-03T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'IN_REVIEW_CLOSED',
              timestamp: new Date('2021-01-19T00:00:00Z').valueOf(),
              userId: 'test',
            },
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-27T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-2'
        )
        expect(result).toEqual({
          elapsedTime: 864000000,
          policyStatus: 'BREACHED',
        })
      })
    })
    describe('test SLA calculation without accountRoles', () => {
      const TEST_POLICY = getTestPolicy({
        id: 'test-policy-3',
      })
      TEST_POLICY.policyConfiguration.accountRoles = undefined
      setUpSLAHooks(tenantId, [TEST_POLICY])
      test('should return the Ok status and time for open alert with 10 day SLA', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-02T00:00:00Z').valueOf(),
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-3'
        )
        expect(result).toEqual({
          elapsedTime: 86400000,
          policyStatus: 'OK',
        })
      })
    })
    describe('test SLA calculation with different days', () => {
      const TEST_POLICY = getTestPolicy({
        id: 'test-policy-4',
        policyConfiguration: {
          alertStatusDetails: {
            alertStatuses: ['OPEN'],
          },
          workingDays: ['MON', 'WED'],
          SLATime: {
            breachTime: {
              units: 2,
              granularity: 'days',
            },
          },
        },
      })
      setUpSLAHooks(tenantId, [TEST_POLICY])
      test('should return the Ok status and time for open alert with 2 day SLA only counting monday and wednesday', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf() // Thursday
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-06T00:00:00Z').valueOf(), // Tuesday
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-4'
        )
        expect(result).toEqual({
          elapsedTime: 86400000,
          policyStatus: 'OK',
        })
      })
      test('should return the Breached status and time for open alert with 2 day SLA only counting monday and wednesday', async () => {
        const mongoDb = await getMongoDbClient()
        const service = new AlertsSLAService(tenantId, mongoDb, 'test')
        const timestamp = new Date('2021-01-01T00:00:00Z').valueOf() // Thursday
        const alert: Alert = getTestAlert({
          createdTimestamp: timestamp,
          alertStatus: 'CLOSED',
          statusChanges: [
            {
              caseStatus: 'CLOSED',
              timestamp: new Date('2021-01-08T00:00:00Z').valueOf(), // Thursday
              userId: 'test',
            },
          ],
        })

        const result = await service.calculateSLAStatusForAlert(
          alert,
          'test-policy-4'
        )
        expect(result).toEqual({
          elapsedTime: 172800000,
          policyStatus: 'BREACHED',
        })
      })
    })
  })
  describe('test calculation of SLA status for all non closed alerts', () => {
    const TEST_POLICY1 = getTestPolicy({
      id: 'test-policy-5',
    })
    const TEST_POLICY2 = getTestPolicy({
      id: 'test-policy-6',
      policyConfiguration: {
        accountRoles: ['test'],
        alertStatusDetails: {
          alertStatuses: ['OPEN'],
        },
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        SLATime: {
          breachTime: {
            units: 2,
            granularity: 'days',
          },
        },
      },
    })
    setUpSLAHooks(tenantId, [TEST_POLICY1, TEST_POLICY2])
    test('should calculate SLA policy status for non closed alerts', async () => {
      const mongoDb = await getMongoDbClient()
      const caseRepository = new CaseRepository(tenantId, { mongoDb })
      const service = new AlertsSLAService(tenantId, mongoDb, 'test')
      const timestamp = new Date('2021-01-01T00:00:00Z').valueOf()
      /* Creating alerts in two cases to verify the SLA status calculation */
      await caseRepository.addCaseMongo({
        caseId: 'testCase1',
        caseStatus: 'OPEN',
        caseType: 'SYSTEM',
        caseAggregates: {} as CaseAggregates,
        alerts: [
          getTestAlert({
            alertId: 'testAlert1',
            createdTimestamp: timestamp,
            alertStatus: 'IN_REVIEW_OPEN',
            slaPolicyDetails: [
              {
                slaPolicyId: 'test-policy-5',
                elapsedTime: 0,
                policyStatus: 'OK',
              },
              {
                slaPolicyId: 'test-policy-6',
                elapsedTime: 0,
                policyStatus: 'OK',
              },
            ],
            statusChanges: [
              {
                caseStatus: 'IN_REVIEW_OPEN',
                timestamp: new Date('2021-01-03T00:00:00Z').valueOf(),
                userId: 'test',
              },
            ],
          }),
          getTestAlert({
            alertId: 'testAlert2',
            createdTimestamp: timestamp,
            alertStatus: 'IN_REVIEW_OPEN',
            slaPolicyDetails: [
              {
                slaPolicyId: 'test-policy-6',
                elapsedTime: 0,
                policyStatus: 'OK',
              },
            ],
            statusChanges: [
              {
                caseStatus: 'IN_REVIEW_OPEN',
                timestamp: new Date('2021-01-02T00:00:00Z').valueOf(),
                userId: 'test',
              },
            ],
          }),
        ],
      })
      await caseRepository.addCaseMongo({
        caseId: 'testCase2',
        caseStatus: 'OPEN',
        caseType: 'SYSTEM',
        caseAggregates: {} as CaseAggregates,
        alerts: [
          getTestAlert({
            alertId: 'testAlert3',
            createdTimestamp: timestamp,
            alertStatus: 'IN_REVIEW_OPEN',
            slaPolicyDetails: [
              {
                slaPolicyId: 'test-policy-5',
                elapsedTime: 0,
                policyStatus: 'OK',
              },
              {
                slaPolicyId: 'test-policy-6',
                elapsedTime: 0,
                policyStatus: 'OK',
              },
            ],
            statusChanges: [
              {
                caseStatus: 'IN_REVIEW_OPEN',
                timestamp: new Date('2021-01-11T00:00:00Z').valueOf(),
                userId: 'test',
              },
            ],
          }),
        ],
      })
      await service.calculateAndUpdateSLAStatuses()
      const alertsRepository = new AlertsRepository(tenantId, { mongoDb })
      const alert1 = await alertsRepository.getAlertById('testAlert1')
      const alert2 = await alertsRepository.getAlertById('testAlert2')
      const alert3 = await alertsRepository.getAlertById('testAlert3')
      expect(alert1?.slaPolicyDetails).toMatchObject([
        {
          slaPolicyId: 'test-policy-5',
          elapsedTime: 172800000,
          policyStatus: 'OK',
        },
        {
          slaPolicyId: 'test-policy-6',
          elapsedTime: 172800000,
          policyStatus: 'BREACHED',
        },
      ])
      expect(alert2?.slaPolicyDetails).toMatchObject([
        {
          slaPolicyId: 'test-policy-6',
          elapsedTime: 86400000,
          policyStatus: 'OK',
        },
      ])
      expect(alert3?.slaPolicyDetails).toMatchObject([
        {
          slaPolicyId: 'test-policy-5',
          elapsedTime: 864000000,
          policyStatus: 'BREACHED',
        },
        {
          slaPolicyId: 'test-policy-6',
          elapsedTime: 864000000,
          policyStatus: 'BREACHED',
        },
      ])
    })
  })
})
