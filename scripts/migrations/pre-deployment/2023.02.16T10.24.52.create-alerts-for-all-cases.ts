import _ from 'lodash'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import {
  getMongoDbClient,
  COUNTER_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongoDBUtils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { OptionalPagination } from '@/utils/pagination'
import { Alert } from '@/@types/openapi-internal/Alert'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { Case } from '@/@types/openapi-internal/Case'

export async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const db = mongodb.db()

  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb: mongodb,
  })

  const queryParams: OptionalPagination<DefaultApiGetCaseListRequest> = {
    pageSize: 'DISABLED',
    includeTransactions: true,
    includeTransactionUsers: true,
  }
  queryParams.afterTimestamp = 0
  queryParams.beforeTimestamp = Date.now()
  const casesCursor = await caseRepository.getCasesCursor(queryParams)

  let caseEntity = await casesCursor.next()
  while (caseEntity) {
    if (!caseEntity.alerts) {
      const alertMap: { [key: string]: Alert } = {}
      caseEntity.caseTransactions?.map((transaction) => {
        transaction.hitRules.map(async (hitRule) => {
          if (!(hitRule.ruleInstanceId in alertMap)) {
            alertMap[hitRule.ruleInstanceId] = {
              createdTimestamp: transaction.timestamp,
              latestTransactionArrivalTimestamp: transaction.timestamp,
              alertStatus: 'OPEN',
              ruleId: hitRule.ruleId,
              ruleInstanceId: hitRule.ruleInstanceId,
              ruleName: hitRule.ruleName,
              ruleDescription: hitRule.ruleDescription,
              ruleAction: hitRule.ruleAction,
              numberOfTransactionsHit: 1,
              priority: 'P1',
            }
          } else {
            alertMap[hitRule.ruleInstanceId] = {
              ...alertMap[hitRule.ruleInstanceId],
              numberOfTransactionsHit:
                alertMap[hitRule.ruleInstanceId].numberOfTransactionsHit + 1,
              latestTransactionArrivalTimestamp: transaction.timestamp,
            }
          }
        })
      })
      caseEntity.alerts = Object.values(alertMap)
      const session = mongodb.startSession()

      await session.withTransaction(async () => {
        const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
        if (caseEntity!.alerts) {
          caseEntity!.alerts = await Promise.all(
            caseEntity!.alerts?.map(async (alert) => {
              if (alert._id && alert.alertId) {
                return alert
              }
              const counterCollection = db.collection<EntityCounter>(
                COUNTER_COLLECTION(tenant.id)
              )
              const alertCount = (
                await counterCollection.findOneAndUpdate(
                  { entity: 'Alert' },
                  { $inc: { count: 1 } },
                  { upsert: true, returnDocument: 'after' }
                )
              ).value

              return {
                _id: alertCount?.count,
                alertId: `A-${alertCount?.count}`,
                caseId: caseEntity!.caseId,
                ...alert,
              }
            })
          )
          await casesCollection.replaceOne(
            { caseId: caseEntity!.caseId },
            caseEntity!,
            { upsert: true }
          )
        }
      })
    }
    caseEntity = await casesCursor.next()
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skipping
}
