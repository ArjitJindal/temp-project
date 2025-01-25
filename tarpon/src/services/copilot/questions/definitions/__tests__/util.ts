import { MongoClient } from 'mongodb'
import {
  AggregationQuestion,
  InvestigationContext,
  Variables,
} from '@/services/copilot/questions/types'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AccountsService } from '@/services/accounts'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import { getDynamoDbClient } from '@/utils/dynamodb'
jest.mock('@/services/accounts')

export async function testQuestion<V extends Variables, D>(
  q: AggregationQuestion<V, D>,
  v: Partial<V> = {},
  seed: (tenantId: string, mongoDb: MongoClient) => Promise<void>,
  assertions: (data: D) => void
) {
  const tenantId = getTestTenantId()
  const mongoDb = await getMongoDbClient()
  await seed(tenantId, mongoDb)

  const c: Case = {
    caseId: 'C-1',
    caseType: 'SYSTEM',
    caseAggregates: DEFAULT_CASE_AGGREGATES,
  }
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
  const user: InternalConsumerUser = {
    createdTimestamp: new Date().valueOf(),
    type: 'CONSUMER',
    userId: 'U-1',
  }

  const accountService = AccountsService.getInstance(getDynamoDbClient())
  const ctx: InvestigationContext = {
    tenantId,
    caseId: 'C-1',
    alertId: 'A-1',
    userId: 'U-1',
    _case: c,
    username: 'John Smith',
    alert,
    user,
    accountService,
    convert: (amount) => amount,
    humanReadableId: 'John Smith',
  }

  const result = await q.aggregationPipeline(ctx, { ...q.defaults(ctx), ...v })
  assertions(result.data)
}
