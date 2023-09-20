import { MongoClient } from 'mongodb'
import { Question, Variables } from '@/services/copilot/questions/types'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'

export async function testQuestion<V extends Variables, D>(
  q: Question<V, D>,
  v: Partial<V> = {},
  seed: (tenantId: string, mongoDb: MongoClient) => Promise<void>,
  assertions: (data: D) => void
) {
  const tenantId = getTestTenantId()
  const mongoDb = await getMongoDbClient()
  await seed(tenantId, mongoDb)

  const c: Case = { caseId: 'C-1', caseType: 'SYSTEM' }
  const alert: Alert = {
    createdTimestamp: 0,
    numberOfTransactionsHit: 0,
    priority: 'P1',
    ruleAction: 'FLAG',
    ruleDescription: '',
    ruleId: '',
    ruleInstanceId: '',
    ruleName: '',
    alertId: 'A-1',
  }
  const ctx = {
    tenantId,
    caseId: 'C-1',
    alertId: 'A-1',
    userId: 'U-1',
    _case: c,
    alert,
  }
  const data = await q.aggregationPipeline(ctx, { ...q.defaults(ctx), ...v })

  assertions(data)
}
