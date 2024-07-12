import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import {
  CASES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const hitCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  for await (const c of collection.find({})) {
    for (const alert of c.alerts ?? []) {
      if (alert.ruleHitMeta?.sanctionsDetails) {
        if (
          !alert.ruleHitMeta?.sanctionsDetails?.find((v) => v.sanctionHitIds)
        ) {
          const newSanctionsDetails = await Promise.all(
            alert.ruleHitMeta?.sanctionsDetails.map(async (v) => {
              if (!v.searchId) {
                throw new Error('missing searchId')
              }
              const hits = await hitCollection
                .find({ searchId: v.searchId })
                .toArray()
              return {
                ...v,
                sanctionHitIds: hits.map((h) => h.sanctionsHitId),
              }
            })
          )
          await collection.updateOne(
            { caseId: c.caseId },
            {
              $set: {
                'alerts.$[alert].ruleHitMeta.sanctionsDetails':
                  newSanctionsDetails,
              },
            },
            {
              arrayFilters: [{ 'alert.alertId': alert.alertId }],
            }
          )
          console.log(`Migrated case ${c.caseId} alert ${alert.alertId}`)
        }
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
