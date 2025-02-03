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
    if (job.parameters.type === 'ALL') {
      const tenants = await TenantService.getAllTenants()

      for (const tenant of tenants) {
        await this.syncTenantAccounts(tenant.tenant, tenant.auth0Domain)
        await this.syncTenantRoles(tenant.tenant, tenant.auth0Domain)
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
        }
      }
    }
  }

  private async syncTenantAccounts(tenant: Tenant, auth0Domain?: string) {
    const accountService = new AccountsService(
      { auth0Domain: auth0Domain ?? tenant.auth0Domain },
      { dynamoDb: this.dynamoDb as DynamoDBClient }
    )

    const auth0 = accountService.auth0
    const accounts = await auth0.getTenantAccounts(tenant)
    const cache = accountService.cache

    await cache.deleteAllOrganizationAccounts(tenant.id)
    await cache.putMultipleAccounts(tenant.id, accounts)
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

    const roles = await auth0.rolesByNamespace(getNonDemoTenantId(tenant.id))

    for (const role of roles) {
      await cache.createRole(tenant.id, {
        type: 'DATABASE',
        params: {
          ...role,
          name: getNamespacedRoleName(tenant.id, role.name),
        },
      })
    }

    const defaultRoles = await auth0.rolesByNamespace(DEFAULT_NAMESPACE)
    for (const role of defaultRoles) {
      await cache.createRole(DEFAULT_NAMESPACE, {
        type: 'DATABASE',
        params: {
          ...role,
          name: getNamespacedRoleName('default', role.name),
        },
      })
    }

    const rootRole = await auth0.getRolesByName('root')
    await cache.createRole(DEFAULT_NAMESPACE, {
      type: 'DATABASE',
      params: {
        ...rootRole,
        name: 'root',
      },
    })

    const whitelabelRootRole = await auth0.getRolesByName('whitelabel-root')
    await cache.createRole(DEFAULT_NAMESPACE, {
      type: 'DATABASE',
      params: {
        ...whitelabelRootRole,
        name: 'whitelabel-root',
      },
    })
  }
}
