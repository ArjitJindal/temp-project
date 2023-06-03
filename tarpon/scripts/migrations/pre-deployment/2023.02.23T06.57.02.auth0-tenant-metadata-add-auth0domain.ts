import { ManagementClient } from 'auth0'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getAuth0Credentials } from '@/utils/auth0-utils'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const { clientId, clientSecret } = await getAuth0Credentials(auth0Domain)
  const managementClient = new ManagementClient({
    domain: auth0Domain,
    clientId,
    clientSecret,
  })
  const org = await managementClient.organizations.getByID({ id: tenant.orgId })
  await managementClient.organizations.update(
    { id: tenant.orgId },
    {
      metadata: {
        ...org.metadata,
        auth0Domain: auth0Domain,
      },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
