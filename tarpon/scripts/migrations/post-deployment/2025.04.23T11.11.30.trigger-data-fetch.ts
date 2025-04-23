import { migrateAllTenants } from '../utils/tenant'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts/repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

let hasFeatureAcuris = false
let hasFeatureOpenSanctions = false
async function migrateTenant(tenant: Tenant) {
  if (hasFeature('DOW_JONES')) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: tenant.id,
      providers: ['dowjones'],
      parameters: {},
    })
  } else if (hasFeature('ACURIS')) {
    hasFeatureAcuris = true
  } else if (hasFeature('OPEN_SANCTIONS')) {
    hasFeatureOpenSanctions = true
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  if (hasFeatureAcuris) {
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
  if (hasFeatureOpenSanctions) {
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
