import { renameRuleParameter } from '../utils/rule'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { envIs } from '@/utils/env'
import { COUNTER_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

export const up = async () => {
  if (envIs('sandbox')) {
    const db = await getMongoDbClientDb()
    for (const tenantId of ['pnb', 'pnb_uat']) {
      const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
        dynamoDb: getDynamoDbClient(),
      })
      const ruleInstances = (
        await ruleInstanceRepository.getAllRuleInstances()
      ).filter((v) => v.ruleId === 'R-16')
      const count = Math.max(
        ...ruleInstances.map((v) => Number(v.id?.split('.')[1]))
      )
      await db
        .collection(COUNTER_COLLECTION(tenantId))
        .insertOne({ entity: 'R-18', count })
      for (const ruleInstance of ruleInstances) {
        await ruleInstanceRepository.createOrUpdateRuleInstance(
          {
            ...ruleInstance,
            id: (ruleInstance.id as string).replace('R-16', 'R-18'),
            ruleId: 'R-18',
          },
          ruleInstance.updatedAt
        )
      }
    }
  }

  await renameRuleParameter(
    ['sanctions-consumer-user'],
    [],
    'fuzzinessRange',
    'fuzziness',
    (value) => value.upperBound
  )
}
export const down = async () => {
  // skip
}
