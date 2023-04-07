import { StackConstants } from '@cdk/constants'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'
import { Alert } from '@/@types/openapi-internal/Alert'

export async function addTxnIdsToAlerts(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cases = await casesCollections.find()

  for await (const caseItem of cases) {
    const originMethods = new Map<string, PaymentMethod>()
    const destinationMethods = new Map<string, PaymentMethod>()
    caseItem.caseTransactions?.forEach((t) => {
      originMethods.set(
        t.transactionId,
        t.originPaymentDetails?.method as PaymentMethod
      )
      destinationMethods.set(
        t.transactionId,
        t.destinationPaymentDetails?.method as PaymentMethod
      )
    })
    const correctedAlerts = caseItem.alerts
      ?.map((a) => {
        if (!a) {
          return
        }
        a.originPaymentMethods = _.uniq(
          a.transactionIds?.map((t) => originMethods.get(t))
        ) as PaymentMethod[]
        a.destinationPaymentMethods = _.uniq(
          a.transactionIds?.map((t) => destinationMethods.get(t))
        ) as PaymentMethod[]

        return a
      })
      .filter(Boolean)
    await casesCollections.updateOne(
      { _id: caseItem._id },
      {
        $set: {
          alerts: correctedAlerts as Alert[],
        },
      }
    )
  }
}
export const up = async () => {
  await migrateAllTenants(addTxnIdsToAlerts)
}
export const down = async () => {
  // skip
}
