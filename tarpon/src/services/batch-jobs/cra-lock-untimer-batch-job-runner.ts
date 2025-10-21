import { RiskService } from '../risk'
import { BatchJobRunner } from './batch-job-runner-base'
import { CraLockUntimerBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'

export class CraLockUntimerBatchJobRunner extends BatchJobRunner {
  protected async run(job: CraLockUntimerBatchJob): Promise<void> {
    // Note: Feature flag check (CRA_LOCK_TIMER) is performed at scheduling time in cron-job-ten-minute
    // Only tenants with the feature enabled will have jobs scheduled
    logger.info(
      `Starting CRA lock untimer batch job for tenant ${job.tenantId} (runs every 30 minutes)`
    )

    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    logger.info(
      `Checking for individually expired CRA locks for tenant ${job.tenantId}`
    )

    // Create risk service and unlock expired locks
    // No longer using tenant-level timer - each lock has its own expiration time
    const riskService = new RiskService(job.tenantId, {
      dynamoDb,
      mongoDb,
    })

    const unlockedUserIds = await riskService.unlockExpiredCraLocks()

    logger.info(
      `CRA lock untimer batch job completed for tenant ${job.tenantId}. ` +
        `Unlocked ${
          unlockedUserIds.length
        } expired locks: ${unlockedUserIds.join(', ')}`
    )
  }
}
