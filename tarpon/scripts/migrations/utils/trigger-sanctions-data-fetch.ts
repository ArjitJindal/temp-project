import { hasFeature } from '@/core/utils/context'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { isDemoTenant } from '@/utils/tenant'

export async function sendTenantSpecificSanctionsDataFetch(tenantId: string) {
  if (hasFeature('DOW_JONES') && !isDemoTenant(tenantId)) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: tenantId,
      providers: ['dowjones'],
      parameters: {},
    })
  }
}

export async function sendAcurisSanctionsDataFetch() {
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

export async function sendOpenSanctionsSanctionsDataFetch() {
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
