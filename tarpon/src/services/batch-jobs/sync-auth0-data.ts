import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AccountsService } from '../accounts'
import { TenantService } from '../tenants'
import { RoleService } from '../roles'
import { getNamespacedRoleName } from '../roles/utils'
import { DEFAULT_NAMESPACE } from '../roles/repository'
import { Tenant } from '../accounts/repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SyncAuth0DataBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { DEFAULT_ROLES_V2 } from '@/core/default-roles'

@traceable
export class SyncAuth0DataRunner extends BatchJobRunner {
  private dynamoDb?: DynamoDBDocumentClient

  private getTenantAccountAndRoleServices = (
    tenant: Tenant,
    auth0Domain: string
  ) => {
    const accountService = new AccountsService(
      { auth0Domain: auth0Domain ?? tenant.auth0Domain },
      { dynamoDb: this.dynamoDb as DynamoDBClient }
    )
    const rolesService = RoleService.getInstance(
      this.dynamoDb as DynamoDBClient,
      auth0Domain ?? tenant.auth0Domain
    )

    return { accountService, rolesService }
  }

  protected async run(job: SyncAuth0DataBatchJob) {
    this.dynamoDb = getDynamoDbClient()
    const allAuth0Domains: Set<string> = new Set()

    if (job.parameters.type === 'ALL') {
      const tenants = await TenantService.getAllTenants()

      for (const tenant of tenants) {
        const auth0Domain = tenant.auth0Domain ?? process.env.AUTH0_DOMAIN
        const { accountService, rolesService } =
          this.getTenantAccountAndRoleServices(tenant.tenant, auth0Domain)
        await accountService.syncTenantAccounts(tenant.tenant)
        await rolesService.syncTenantRoles(tenant.tenant)
        allAuth0Domains.add(auth0Domain)
      }
    } else if (job.parameters.type === 'TENANT_IDS') {
      const tenantIds = job.parameters.tenantIds
      const accountsService = AccountsService.getInstance(
        this.dynamoDb as DynamoDBClient,
        false
      )

      for (const tenantId of tenantIds) {
        const tenant = await accountsService.getTenantById(tenantId)
        if (tenant) {
          const auth0Domain = tenant.auth0Domain ?? process.env.AUTH0_DOMAIN
          const { accountService, rolesService } =
            this.getTenantAccountAndRoleServices(tenant, auth0Domain)
          await accountService.syncTenantAccounts(tenant)
          await rolesService.syncTenantRoles(tenant)
          allAuth0Domains.add(auth0Domain)
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
            statements: DEFAULT_ROLES_V2.find(
              (r) => r.role.toLowerCase() === role.name.toLowerCase()
            )?.permissions,
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
            statements: DEFAULT_ROLES_V2.find(
              (r) => r.role.toLowerCase() === rootRole.name.toLowerCase()
            )?.permissions,
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
            statements: DEFAULT_ROLES_V2.find(
              (r) =>
                r.role.toLowerCase() === whitelabelRootRole.name.toLowerCase()
            )?.permissions,
          },
        })
      }
    }
  }
}
