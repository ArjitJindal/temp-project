import { chunk, groupBy, mapValues } from 'lodash'
import dayjs from './dayjs'
import { TenantInfo } from '@/services/tenants'
import { logger } from '@/core/logger'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export async function createApiUsageJobs(tenantInfos: TenantInfo[]) {
  const tenantData = tenantInfos.map((t) => {
    return { id: t.tenant.id, name: t.tenant.name, auth0Domain: t.auth0Domain }
  })
  const tenantsBySheets = mapValues(
    groupBy(tenantData, (tenant) => {
      const auth0Tenant = tenantInfos.find((t) => t.tenant.id === tenant.id)
      return auth0Tenant?.auth0TenantConfig.apiUsageGoogleSheetId ?? ''
    }),
    (tenants) =>
      tenants.map((tenant) => {
        const auth0Tenant = tenantInfos.find((t) => t.tenant.id === tenant.id)
        return {
          ...tenant,
          auth0Domain: auth0Tenant?.auth0Domain,
        }
      })
  )

  for (const sheetId in tenantsBySheets) {
    for (const tenants of chunk(tenantsBySheets[sheetId], 5)) {
      const googleSheetIds = [
        process.env.API_USAGE_GOOGLE_SHEET_ID as string,
        sheetId,
      ].filter(Boolean)

      logger.info(
        `Sending API usage metrics for ${tenants.map((t) => t.id).join(', ')}`
      )

      await sendBatchJobCommand({
        type: 'API_USAGE_METRICS',
        tenantId: '',
        parameters: {
          tenantInfos: tenants,
          targetMonth: dayjs().subtract(2, 'day').format('YYYY-MM'),
          googleSheetIds: googleSheetIds,
        },
      })
    }
  }
}
