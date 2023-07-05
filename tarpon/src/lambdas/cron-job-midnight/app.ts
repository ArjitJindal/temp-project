import _ from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-job'
import {
  ApiUsageMetricsBatchJob,
  OngoingScreeningUserRuleBatchJob,
} from '@/@types/batch-job'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { logger } from '@/core/logger'

const ONGOING_SCREENING_USERS_BATCH_SIZE = 100

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

  // Wait for 1 second to make sure that it is already a new day
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const allBasicTenantDetails =
    await TenantService.getTenantInfoFromUsagePlans()

  for await (const usageTenant of allBasicTenantDetails) {
    try {
      await sendBatchJobCommand(usageTenant.id, {
        type: 'API_USAGE_METRICS',
        tenantInfo: usageTenant,
        tenantId: usageTenant.id,
      } as ApiUsageMetricsBatchJob)
    } catch (error) {
      logger.error(
        new Error(
          `Error publishing API usage metrics for tenant ${usageTenant.id}, ${
            (error as Error).message
          }`
        )
      )
    }
  }

  for await (const tenant of tenantInfos) {
    try {
      const tenantId = tenant.tenant.id
      if (await shouldStartOngoingScreeningJob(tenantId)) {
        const userRepository = new UserRepository(tenantId, {
          mongoDb,
        })
        let userIdsBatch: string[] = []
        // One job only deals with a subset of users to avoid the job to run for over 15 minutes
        for await (const item of await userRepository.getAllUserIdsCursor()) {
          userIdsBatch.push(item.userId)
          if (userIdsBatch.length === ONGOING_SCREENING_USERS_BATCH_SIZE) {
            await sendBatchJobCommand(tenantId, {
              type: 'ONGOING_SCREENING_USER_RULE',
              tenantId,
              userIds: userIdsBatch,
            } as OngoingScreeningUserRuleBatchJob)
            userIdsBatch = []
          }
        }
        if (userIdsBatch.length > 0) {
          await sendBatchJobCommand(tenantId, {
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
            userIds: userIdsBatch,
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
