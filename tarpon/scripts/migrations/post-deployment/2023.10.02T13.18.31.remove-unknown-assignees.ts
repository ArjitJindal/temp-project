import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService, Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'
import { Case } from '@/@types/openapi-internal/Case'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('sandbox')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: 'sandbox-flagright.eu.auth0.com' },
    { mongoDb }
  )
  const accounts = await accountsService.getTenantAccounts(tenant)
  const accountIds = accounts.map((a) => a.id)
  const db = mongoDb.db()

  const cases = await db
    .collection<Case>(CASES_COLLECTION(tenant.id))
    .find(
      {
        $or: [
          {
            'assignments.0': { $exists: true },
            'assignments.assigneeUserId': { $nin: accountIds },
          },
          {
            'reviewAssignments.0': { $exists: true },
            'reviewAssignments.assigneeUserId': { $nin: accountIds },
          },
        ],
      },
      { projection: { caseId: 1, assignments: 1, reviewAssignments: 1 } }
    )
    .toArray()

  for (const c of cases) {
    const assignments = c.assignments?.filter((assignment) =>
      accountIds.includes(assignment.assigneeUserId)
    )
    const reviewAssignments = c.reviewAssignments?.filter((assignment) =>
      accountIds.includes(assignment.assigneeUserId)
    )
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenant.id))
      .updateOne(
        {
          caseId: c.caseId,
        },
        { $set: { assignments, reviewAssignments } }
      )
    logger.info(`${c.caseId} - ${JSON.stringify(result)}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
