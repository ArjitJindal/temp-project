import { MongoClient } from 'mongodb'
import { Question } from '@/services/copilot/questions/types'
import { AlertHistory } from '@/services/copilot/questions/definitions/alert-history'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export async function testQuestion<D>(
  q: Question<any, D>,
  seed: (tenantId: string, mongoDb: MongoClient) => Promise<void>,
  assertions: (data: D) => void
) {
  const tenantId = getTestTenantId()
  const mongoDb = await getMongoDbClient()
  await seed(tenantId, mongoDb)

  const data = await q.aggregationPipeline(
    {
      tenantId,
      caseId: 'C-1',
      alertId: 'A-1',
      userId: 'U-1',
    },
    AlertHistory.applyDefaults ? AlertHistory.applyDefaults({}) : {}
  )

  assertions(data)
}
