import chunk from 'lodash/chunk'
import groupBy from 'lodash/groupBy'
import mapValues from 'lodash/mapValues'
import {
  getAllUsagePlans,
  getTenantIdFromUsagePlanName,
} from '@flagright/lib/tenants/usage-plans'
import {
  APIGatewayClient,
  GetUsagePlanKeysCommand,
  UpdateApiKeyCommand,
} from '@aws-sdk/client-api-gateway'
import dayjs from './dayjs'
import { envIs } from './env'
import { TenantInfo } from '@/services/tenants'
import { logger } from '@/core/logger'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export async function toggleApiKeys(tenantId: string, newState: boolean) {
  const allUsagePlans = await getAllUsagePlans(
    envIs('local') ? 'eu-central-1' : (process.env.AWS_REGION as string)
  )

  const usagePlan = allUsagePlans.find(
    (usagePlan) =>
      getTenantIdFromUsagePlanName(usagePlan.name as string) === tenantId
  )

  if (!usagePlan) {
    logger.warn(`Usage plan not found for tenant ${tenantId}`)
    return
  }

  const apigateway = new APIGatewayClient({
    region: process.env.AWS_REGION,
    maxAttempts: 10,
  })

  const usagePlanKeysCommand = new GetUsagePlanKeysCommand({
    usagePlanId: usagePlan.id,
  })

  const usagePlanKeys = await apigateway.send(usagePlanKeysCommand)

  if (!usagePlanKeys.items?.length) {
    logger.warn(`Usage plan ${usagePlan.id} does not have any keys`)
    return
  }

  for (const key of usagePlanKeys.items) {
    await apigateway.send(
      new UpdateApiKeyCommand({
        apiKey: key.id,
        patchOperations: [
          {
            op: 'replace',
            path: '/enabled',
            value: newState ? 'true' : 'false',
          },
        ],
      })
    )
  }
}

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
        tenantId: FLAGRIGHT_TENANT_ID,
        parameters: {
          tenantInfos: tenants,
          targetMonth: dayjs().subtract(2, 'day').format('YYYY-MM'),
          googleSheetIds: googleSheetIds,
        },
      })
    }
  }
}
