import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import {
  CASES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const hitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  const totalCases = await casesCollection.countDocuments()
  let caseCounter = 0
  let modifiedCounter = 0
  for await (const c of casesCollection.find({})) {
    logger.debug(`Handling case ${caseCounter++} of ${totalCases}`)
    const originUserId = c.caseUsers?.origin?.userId
    const destinationUserId = c.caseUsers?.destination?.userId
    const userId = originUserId || destinationUserId || null
    if (userId != null) {
      for (const alert of c.alerts ?? []) {
        for (const details of alert.ruleHitMeta?.sanctionsDetails ?? []) {
          const allHitIds = details.sanctionHitIds

          const entityMap = {
            CONSUMER_NAME: 'USER',
            LEGAL_NAME: 'USER',
            SHAREHOLDER: 'USER',
            DIRECTOR: 'USER',
            NAME_ON_CARD: 'EXTERNAL_USER',
            PAYMENT_NAME: 'EXTERNAL_USER',
            PAYMENT_BENEFICIARY_NAME: 'EXTERNAL_USER',
            BANK_NAME: 'EXTERNAL_USER',
          }

          const { modifiedCount } = await hitsCollection.updateMany(
            {
              sanctionsHitId: { $in: allHitIds },
            },
            [
              {
                $set: {
                  'hitContext.userId': {
                    $ifNull: ['$hitContext.userId', userId],
                  },
                  'hitContext.ruleInstanceId': {
                    $ifNull: [
                      '$hitContext.ruleInstanceId',
                      alert.ruleInstanceId,
                    ],
                  },
                  'hitContext.entity': {
                    $ifNull: [
                      '$hitContext.entity',
                      details.entityType
                        ? entityMap[details.entityType]
                        : undefined,
                    ],
                  },
                  'hitContext.entityType': {
                    $ifNull: ['$hitContext.entityType', details.entityType],
                  },
                },
              },
            ]
          )
          modifiedCounter += modifiedCount
        }
      }
    }
  }
  logger.info(`Migrated tenant ${tenant.id}, modified ${modifiedCounter} hits`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
