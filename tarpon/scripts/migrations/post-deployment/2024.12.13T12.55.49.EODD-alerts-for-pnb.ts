import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { envIsNot } from '@/utils/env'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { RulesEngineService } from '@/services/rules-engine'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'pnb' || envIsNot('prod')) {
    return
  }
  const listId = '06b705b0-66ad-4add-b49c-9457e5fefcce' // EODD list ID
  const dynamoDb = getDynamoDbClient()
  const listRepository = new ListRepository(tenant.id, dynamoDb)
  const userIds: string[] = []
  const listHeader = await listRepository.getListHeader(listId)
  if (listHeader) {
    let fromCursorKey: string | undefined
    let hasNext = true
    while (hasNext) {
      const listItems = await listRepository.getListItems(
        listId,
        {
          pageSize: 100,
          fromCursorKey,
        },
        listHeader.version
      )
      listItems.items.map((i) => {
        if (typeof i.key === 'string') {
          userIds.push(i.key)
        }
      })
      fromCursorKey = listItems.next
      hasNext = listItems.hasNext
    }
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const alerts = await casesCollection
    .aggregate([
      {
        $match: {
          'alerts.ruleInstanceId': 'RC-15',
        },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: {
          'alerts.ruleInstanceId': 'RC-15',
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$caseUsers.origin.userId',
        },
      },
    ])
    .toArray()
  const userIdsAlreadyHit = new Set(alerts.map((a) => a.userId))
  const logicEvaluator = new LogicEvaluator(tenant.id, dynamoDb)
  const rulesEngineService = new RulesEngineService(
    tenant.id,
    dynamoDb,
    logicEvaluator,
    mongoDb
  )
  const userRepository = new UserRepository(tenant.id, { dynamoDb, mongoDb })
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const eoddRule = await ruleInstanceRepository.getRuleInstanceById('RC-15')
  if (!eoddRule) {
    return
  }
  for (const userId of userIds) {
    if (userIdsAlreadyHit.has(userId)) {
      continue
    }
    const user = await userRepository.getUser<UserWithRulesResult>(userId)
    if (!user) {
      continue
    }
    const { hitRules, executedRules } =
      await rulesEngineService.verifyUserByRules(
        user,
        [eoddRule],
        [],
        'ONGOING'
      )
    if (hitRules?.length && executedRules?.length) {
      const userToSave = {
        ...user,
        hitRules: [...(user.hitRules || []), ...hitRules],
        executedRules: [...(user.executedRules || []), ...executedRules],
      }
      await userRepository.saveConsumerUser(userToSave)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
