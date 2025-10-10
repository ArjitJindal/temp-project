import { DynamoAlertRepository } from '../dynamo-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Alert } from '@/@types/openapi-internal/Alert'

dynamoDbSetupHook()

const sampleAlert: Alert = {
  alertId: 'A-1',
  caseId: 'C-1',
  alertStatus: 'OPEN',
  statusChanges: [],
  updatedAt: Date.now(),
  createdTimestamp: Date.now(),
  ruleInstanceId: 'R-1',
  ruleName: 'R-1',
  ruleDescription: 'R-1',
  ruleId: 'R-1',
  numberOfTransactionsHit: 1,
  priority: 'P1',
  ruleAction: 'ALLOW',
  caseSubjectIdentifiers: ['S-1'],
  caseCreatedTimestamp: Date.now(),
}

describe('Dynamo Repository', () => {
  test('Update status of alerts', async () => {
    const tenantId = getTestTenantId()
    const alertId = sampleAlert.alertId as string
    const repo = new DynamoAlertRepository(tenantId, getDynamoDbClient())
    await repo.saveAlertsForCase([sampleAlert], 'C-1')
    await repo.updateStatus([alertId], {
      timestamp: Date.now(),
      userId: 'U-1',
      caseStatus: 'CLOSED',
    })
    const alert = await repo.getAlert(alertId)
    expect(alert?.alertStatus).toBe('CLOSED')
    expect(alert?.statusChanges).toHaveLength(1)
  })
})
