import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { AccountsService } from '../accounts'
import { TenantService } from '../tenants'
import { RoleService } from '../roles'
import { getNamespacedRoleName } from '../roles/utils'
import { DEFAULT_NAMESPACE } from '../roles/repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SyncAuth0DataBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getNonDemoTenantId } from '@/utils/tenant'
import { traceable } from '@/core/xray'

@traceable
export class SyncAuth0DataRunner extends BatchJobRunner {
  private dynamoDb?: DynamoDBClient
  protected async run(job: SyncAuth0DataBatchJob) {
    this.dynamoDb = getDynamoDbClient()
    const allAuth0Domains: Set<string> = new Set()
    if (job.parameters.type === 'ALL') {
      const tenants = await TenantService.getAllTenants()

      for (const tenant of tenants) {
        await this.syncTenantAccounts(tenant.tenant, tenant.auth0Domain)
        await this.syncTenantRoles(tenant.tenant, tenant.auth0Domain)
        allAuth0Domains.add(tenant.auth0Domain)
      }
    } else if (job.parameters.type === 'TENANT_IDS') {
      const tenantIds = job.parameters.tenantIds
      const accountsService = AccountsService.getInstance(
        this.dynamoDb as DynamoDBClient
      )

      for (const tenantId of tenantIds) {
        const tenant = await accountsService.getTenantById(tenantId)
        if (tenant) {
          await this.syncTenantAccounts(tenant, tenant.auth0Domain)
          await this.syncTenantRoles(tenant, tenant.auth0Domain)
          allAuth0Domains.add(tenant.auth0Domain)
        }
      }
    }

    for (const auth0Domain of allAuth0Domains) {
      const rolesService = RoleService.getInstance(
        this.dynamoDb as DynamoDBClient,
        auth0Domain
      )
      const roles = await rolesService.auth0.rolesByNamespace(DEFAULT_NAMESPACE)

      for (const role of roles) {
        await rolesService.cache.createRole(DEFAULT_NAMESPACE, {
          type: 'DATABASE',
          params: {
            ...role,
            name: getNamespacedRoleName(DEFAULT_NAMESPACE, role.name),
          },
        })
      }

      const rootRole = await rolesService.auth0.getRolesByName('root')
      if (rootRole) {
        await rolesService.cache.createRole(DEFAULT_NAMESPACE, {
          type: 'DATABASE',
          params: {
            ...rootRole,
            name: getNamespacedRoleName(DEFAULT_NAMESPACE, rootRole.name),
          },
        })
      }

      const whitelabelRootRole = await rolesService.auth0.getRolesByName(
        'whitelabel-root'
      )
      if (whitelabelRootRole) {
        await rolesService.cache.createRole(DEFAULT_NAMESPACE, {
          type: 'DATABASE',
          params: {
            ...whitelabelRootRole,
            name: getNamespacedRoleName(
              DEFAULT_NAMESPACE,
              whitelabelRootRole.name
            ),
          },
        })
      }
    }
  }

  private async syncTenantAccounts(tenant: Tenant, auth0Domain: string) {
    const accountService = new AccountsService(
      { auth0Domain: auth0Domain ?? tenant.auth0Domain },
      { dynamoDb: this.dynamoDb as DynamoDBClient }
    )

    const auth0 = accountService.auth0
    const cache = accountService.cache
    const auth0Accounts = await auth0.getTenantAccounts(tenant)
    const currentCacheAccounts = await cache.getTenantAccounts(tenant)

    // find accounts which are in currentCacheAccounts but not in auth0Accounts
    const accountsToDelete = currentCacheAccounts.filter(
      (account) => !auth0Accounts.some((a) => a.id === account.id)
    )

    for (const account of accountsToDelete) {
      await cache.deleteAccountFromOrganization({ id: tenant.id }, account)
    }

    await cache.putMultipleAccounts(tenant.id, auth0Accounts)
    await cache.createOrganization(tenant.id, {
      type: 'DATABASE',
      params: tenant,
    })
  }

  private async syncTenantRoles(tenant: Tenant, auth0Domain?: string) {
    const rolesService = RoleService.getInstance(
      this.dynamoDb as DynamoDBClient,
      auth0Domain ?? tenant.auth0Domain
    )
    const auth0 = rolesService.auth0
    const cache = rolesService.cache

    const auth0Roles = await auth0.rolesByNamespace(
      getNonDemoTenantId(tenant.id)
    )
    const cacheRoles = await cache.getTenantRoles(getNonDemoTenantId(tenant.id))

    // delete roles which are in cache but not in auth0
    const rolesToDelete = cacheRoles.filter(
      (role) => !auth0Roles.some((r) => r.id === role.id)
    )

    for (const role of rolesToDelete) {
      await cache.deleteRole(role.id)
    }

    for (const role of auth0Roles) {
      await cache.createRole(tenant.id, {
        type: 'DATABASE',
        params: {
          ...role,
          name: getNamespacedRoleName(tenant.id, role.name),
        },
      })
    }
  }
}
