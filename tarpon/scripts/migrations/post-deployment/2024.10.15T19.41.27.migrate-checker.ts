import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService, Tenant } from '@/services/accounts'
import { AppMetadata } from '@/utils/auth0-utils'
import { tenantHasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (!(await tenantHasFeature(tenant.id, 'ADVANCED_WORKFLOWS'))) {
    return
  }

  const mongoDbClient = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain },
    { mongoDb: mongoDbClient }
  )

  const accounts = await accountsService.getTenantAccountsRaw(tenant)
  const reviewerIds: string[] = []
  for (const account of accounts) {
    const appMetadata: AppMetadata =
      account.app_metadata as unknown as AppMetadata

    if (appMetadata.reviewerId) {
      reviewerIds.push(appMetadata.reviewerId)
    }

    if (!account.app_metadata.isEscalationContact) {
      await accountsService.updateAuth0User(account.user_id, {
        app_metadata: {
          ...appMetadata,
          escalationLevel: null,
        },
      })

      continue
    }

    await accountsService.updateAuth0User(account.user_id, {
      app_metadata: {
        ...appMetadata,
        escalationLevel: appMetadata.escalationLevel ?? 'L1',
      },
    })
  }

  for (const reviewerId of reviewerIds) {
    const account = accounts.find((account) => account.user_id === reviewerId)
    if (!account) {
      throw new Error(`Reviewer ID ${reviewerId} not found in accounts`)
    }

    const appMetadata: AppMetadata =
      account.app_metadata as unknown as AppMetadata

    await accountsService.updateAuth0User(reviewerId, {
      app_metadata: {
        ...appMetadata,
        isReviewer: true,
      },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
