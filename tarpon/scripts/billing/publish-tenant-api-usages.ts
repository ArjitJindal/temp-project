process.env.AWS_XRAY_CONTEXT_MISSING = 'IGNORE_ERROR'

import { exit } from 'process'
import commandLineArgs from 'command-line-args'

import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { loadConfigEnv } from '../migrations/utils/config'
import { ApiUsageMetricsService } from '@/services/metrics/api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantBasic } from '@/@types/tenant'
import { TenantService } from '@/services/tenants'

const optionDefinitions = [
  { name: 'tenantId', type: String },
  { name: 'tenantName', type: String },
  { name: 'month', type: String },
]

loadConfigEnv()
const options = commandLineArgs(optionDefinitions)

async function main() {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as Stage,
    process.env.REGION as FlagrightRegion
  )
  const tenantInfo: TenantBasic = {
    id: options.tenantId,
    name: options.tenantName,
    auth0Domain: tenantInfos.find((t) => t.tenant.id === options.tenantId)
      ?.auth0Domain,
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const apiMetricsService = new ApiUsageMetricsService({
    mongoDb,
    dynamoDb,
  })
  await apiMetricsService.publishApiUsageMetrics(tenantInfo, options.month, [
    process.env.API_USAGE_GOOGLE_SHEET_ID as string,
  ])
}

void main().then(() => exit(0))
