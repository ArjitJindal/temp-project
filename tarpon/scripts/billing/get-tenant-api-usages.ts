process.env.AWS_XRAY_CONTEXT_MISSING = 'IGNORE_ERROR'

import { exit } from 'process'
import commandLineArgs from 'command-line-args'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { loadConfigEnv } from '../migrations/utils/config'
import { ApiUsageMetricsService } from '@/services/metrics/api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import { TenantBasic } from '@/services/accounts'
import { TenantService } from '@/services/tenants'

const optionDefinitions = [
  { name: 'tenantId', type: String },
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
    name: options.tenantId,
    auth0Domain: tenantInfos.find((t) => t.tenant.id === options.tenantId)
      ?.auth0Domain,
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const apiMetricsService = new ApiUsageMetricsService({
    mongoDb,
    dynamoDb,
  })
  const timeRange = {
    startTimestamp: dayjs(options.month).startOf('month').valueOf(),
    endTimestamp: dayjs(options.month).endOf('month').valueOf(),
  }
  const dailyValues = await apiMetricsService.getDailyMetricValues(
    tenantInfo,
    timeRange
  )
  const monthlyValues = apiMetricsService.getMonthlyMetricValues(dailyValues)
  console.info(`Daily (${options.month}):`)
  console.info('====================================')
  console.info('%o', dailyValues)
  console.info(`\n\nMonthly (${options.month}):`)
  console.info('====================================')
  console.info('%o', monthlyValues)
}

void main().then(() => exit(0))
