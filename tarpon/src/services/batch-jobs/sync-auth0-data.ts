import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { AccountsService } from '../accounts'
import { TenantService } from '../tenants'
import { BatchJobRunner } from './batch-job-runner-base'
import { SyncAuth0DataBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'

export class SyncAuth0DataRunner extends BatchJobRunner {
  private dynamoDb?: DynamoDBClient
  protected async run(job: SyncAuth0DataBatchJob) {
    this.dynamoDb = getDynamoDbClient()
    if (job.parameters.type === 'ALL') {
      const tenants = await TenantService.getAllTenants()

      for (const tenant of tenants) {
        await this.syncTenant(tenant.tenant)
      }
    } else if (job.parameters.type === 'TENANT_IDS') {
      const tenantIds = job.parameters.tenantIds
      const accountsService = await AccountsService.getInstance(
        this.dynamoDb as DynamoDBClient
      )

      for (const tenantId of tenantIds) {
        const tenant = await accountsService.getTenantById(tenantId)
        if (tenant) {
          await this.syncTenant(tenant)
        }
      }
    }
  }

  private async syncTenant(tenant: Tenant) {
    const accountService = new AccountsService(
      { auth0Domain: tenant.auth0Domain },
      { dynamoDb: this.dynamoDb as DynamoDBClient }
    )

    const auth0 = accountService.auth0()
    const accounts = await auth0.getTenantAccounts(tenant)
    const cache = accountService.cache()

    await cache.putMultipleAccounts(tenant.id, accounts)
    await cache.createOrganization(tenant.id, {
      type: 'DATABASE',
      params: tenant,
    })
  }
}
