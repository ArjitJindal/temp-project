import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('DOW_JONES')) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: tenant.id,
      providers: ['dowjones'],
      parameters: {},
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  const db = await getMongoDbClientDb()
  const acurisCollection = (await db.listCollections().toArray()).find((c) =>
    c.name.includes('acuris')
  )
  if (acurisCollection) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['acuris'],
      parameters: {
        entityType: 'PERSON',
      },
    })
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['acuris'],
      parameters: {
        entityType: 'BUSINESS',
      },
    })
  }
  const openSanctionsCollection = (await db.listCollections().toArray()).find(
    (c) => c.name.includes('open-sanctions')
  )
  if (openSanctionsCollection) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['open-sanctions'],
      parameters: {
        entityType: 'PERSON',
      },
    })
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['open-sanctions'],
      parameters: {
        entityType: 'BUSINESS',
      },
    })
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['open-sanctions'],
      parameters: {
        entityType: 'BANK',
      },
    })
  }
}
export const down = async () => {
  // skip
}
