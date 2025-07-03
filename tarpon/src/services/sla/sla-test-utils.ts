import { Alert } from '@/@types/openapi-internal/Alert'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { SLAPolicyRepository } from '@/services/tenants/repositories/sla-policy-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export function setUpSLAHooks(tenantId: string, slaPolicies: SLAPolicy[]) {
  beforeAll(async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const slaPolicyRepository = new SLAPolicyRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    for (const slaPolicy of slaPolicies) {
      await slaPolicyRepository.createSLAPolicy(slaPolicy)
    }
  })
  afterAll(async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const slaPolicyRepository = new SLAPolicyRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    for (const slaPolicy of slaPolicies) {
      await slaPolicyRepository.deleteSLAPolicy(slaPolicy.id)
    }
  })
}

export function getTestAlert(alert: Partial<Alert> = {}): Alert {
  return {
    alertId: 'testAlert',
    caseId: 'testCase',
    createdTimestamp: new Date('2021-01-01T00:00:00Z').valueOf(),
    alertStatus: 'CLOSED',
    assignments: [
      {
        assigneeUserId: 'test',
        assignedByUserId: 'test',
        timestamp: new Date().valueOf(),
      },
    ],
    ruleInstanceId: 'test',
    ruleId: 'test',
    ruleName: 'test',
    ruleDescription: 'test',
    priority: 'P1',
    ruleAction: 'BLOCK',
    numberOfTransactionsHit: 1,
    ...alert,
  }
}

export function getTestPolicy(slaPolicy: Partial<SLAPolicy> = {}): SLAPolicy {
  return {
    id: 'testPolicy1',
    name: 'testPolicy1',
    description: 'test',
    createdBy: 'testUser',
    type: 'ALERT',
    policyConfiguration: {
      accountRoles: ['test'],
      statusDetails: {
        statuses: ['OPEN'],
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
    ...slaPolicy,
  }
}
