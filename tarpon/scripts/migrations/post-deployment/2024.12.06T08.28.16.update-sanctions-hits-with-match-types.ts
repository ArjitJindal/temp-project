import { intersection } from 'lodash'
import { getMongoDbClient } from '../../../src/utils/mongodb-utils'
import { migrateAllTenants } from '../utils/tenant'
import {
  CASES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'pnb') {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClient()
    const rulesRepository = new RuleInstanceRepository(tenant.id, { dynamoDb })

    const impactedRules = (await rulesRepository.getAllRuleInstances())
      .filter((r) => r.ruleId === 'R-18' && r.hitCount && r.hitCount > 0)
      .map((r) =>
        r.parameters.screeningTypes
          ? {
              ruleId: r.ruleId,
              ruleInstanceId: r.id,
              screeningTypes: r.parameters.screeningTypes,
            }
          : null
      )
      .filter(Boolean) as {
      ruleId: string
      ruleInstanceId: string
      screeningTypes: string[]
    }[]

    const casesCollection = mongoDb.db().collection(CASES_COLLECTION(tenant.id))
    const sanctionsDetailsCursor = casesCollection.aggregate([
      {
        $match: { 'alerts.ruleId': 'R-18' },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: { 'alerts.ruleId': 'R-18' },
      },
      {
        $project: {
          _id: 0,
          sanctionsDetails: '$alerts.ruleHitMeta.sanctionsDetails',
        },
      },
    ])

    const hitsCollection = mongoDb
      .db()
      .collection(SANCTIONS_HITS_COLLECTION(tenant.id))

    const bulkUpdates: any = []
    for await (const sanctionDetail of sanctionsDetailsCursor) {
      const hitIds = sanctionDetail.sanctionsDetails.flatMap(
        (hit) => hit.sanctionHitIds
      )

      const hits = await hitsCollection
        .find({ sanctionsHitId: { $in: hitIds } })
        .toArray()
      for (const hit of hits) {
        const impactedRule = impactedRules.find(
          (r) => r.ruleInstanceId === hit.hitContext.ruleInstanceId
        )

        if (
          impactedRule &&
          intersection(
            impactedRule.screeningTypes,
            hit.entity.sanctionSearchTypes
          ).length === 0
        ) {
          const updatedHit = {
            ...hit,
            entity: {
              ...hit.entity,
              matchTypes: [
                ...(hit.entity.matchTypes ?? []),
                'associate_screening_type',
              ],
            },
          }

          bulkUpdates.push({
            replaceOne: {
              filter: { sanctionsHitId: hit.sanctionsHitId },
              replacement: updatedHit,
            },
          })

          if (bulkUpdates.length >= 500) {
            await hitsCollection.bulkWrite(bulkUpdates)
            bulkUpdates.length = 0
          }
        }
      }
    }

    if (bulkUpdates.length > 0) {
      await hitsCollection.bulkWrite(bulkUpdates)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
