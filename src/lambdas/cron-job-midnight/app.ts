import _ from 'lodash'
import { ApiUsageMetricsService } from './services/api-usage-metrics-service'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-job'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'

/**
 * NOTE: This lambda is triggered by a cron job that runs every day at midnight.
 * If it fails make sure that we make a migration to backfill the missing data.
 * Although try/catch blocks are used in this lambda to reduce the risk of failure,
 * we should still make sure that we backfill the missing data.
 */

async function shouldStartOngoingScreeningJob(
  tenantId: string
): Promise<boolean> {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  ).filter((ruleInstance) => {
    return (
      ruleInstance.parameters?.ongoingScreening ||
      Object.values(ruleInstance.riskLevelParameters ?? {}).find(
        (parameters) => parameters?.ongoingScreening
      )
    )
  })
  if (ruleInstances.length === 0) {
    return false
  }
  return true
}

export const cronJobMidnightHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as 'dev' | 'sandbox' | 'prod',
    process.env.REGION as 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  )

  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const startTimestamp = dayjs().subtract(1, 'day').startOf('day').valueOf()
  const endTimestamp = dayjs().subtract(1, 'day').endOf('day').valueOf()

  for await (const tenant of tenantInfos) {
    try {
      const apiMetricsService = new ApiUsageMetricsService(
        tenant.tenant,
        { mongoDb, dynamoDb },
        { startTimestamp, endTimestamp }
      )
      await apiMetricsService.publishApiUsageMetrics(tenant)
    } catch (error) {
      logger.error(
        new Error(
          `Error publishing API usage metrics for tenant ${tenant.tenant.id}, ${
            (error as Error).message
          }`
        )
      )
    }

    try {
      const tenantId = tenant.tenant.id
      if (await shouldStartOngoingScreeningJob(tenantId)) {
        const userRepository = new UserRepository(tenantId, {
          mongoDb,
        })
        const allUserIds = await userRepository.getAllUsersIds()
        // One job only deals with a subset of users to avoid the job to run for over 15 minutes
        for (const userIds of _.chunk(allUserIds, 1000)) {
          await sendBatchJobCommand(tenantId, {
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
            userIds,
          } as OngoingScreeningUserRuleBatchJob)
        }
      }
    } catch (error) {
      logger.error(
        new Error(
          `Error starting ongoing screening job for tenant ${
            tenant.tenant.id
          } ${(error as Error).message}`
        )
      )
    }
  }
})
