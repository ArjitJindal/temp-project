import {
  createTenantDatabase,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { SanctionsScreeningDetailsRepository } from '@/services/sanctions/repositories/sanctions-screening-details-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

withFeatureHook(['CLICKHOUSE_ENABLED', 'PNB'])

describe('ClickhouseSanctionsRepository', () => {
  const tenantId = getTestTenantId()
  beforeAll(async () => {
    await createTenantDatabase(tenantId)
  })

  afterAll(async () => {
    const client = await getClickhouseClient(tenantId)
    await client.command({
      query: 'truncate table sanctions_screening_details',
    })
  })

  it('should add sanctions screening details', async () => {
    const respository = new SanctionsScreeningDetailsRepository(
      tenantId,
      await getMongoDbClient()
    )
    await respository.addSanctionsScreeningDetails({
      name: 'Vlad Putin',
      entity: 'USER',
      searchId: 'some-search-id',
    })
  })
})
