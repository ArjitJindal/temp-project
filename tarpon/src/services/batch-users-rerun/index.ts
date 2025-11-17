import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { MongoClient } from 'mongodb'
import pMap from 'p-map'
import { BatchJobRepository } from '../batch-jobs/repositories/batch-job-repository'
import { BatchRerunUsersJobPayload } from '@/@types/rerun-users'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { BatchRerunUsersRepository } from '@/services/batch-users-rerun/repository'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskService } from '@/services/risk'
import { RiskScoringV8Service } from '@/services/risk-scoring/risk-scoring-v8-service'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'

@traceable
export class BatchRerunUsersService {
  private tenantId: string
  private dynamoDb: DynamoDBClient
  private mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBClient; mongoDb: MongoClient }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.mongoDb = connections.mongoDb
  }

  async run(job: BatchRerunUsersJobPayload) {
    const { jobType, userIds } = job
    switch (jobType) {
      case 'RERUN_RISK_SCORING':
        await this.rerunRiskScoring(job.jobId, userIds)
        break
    }
  }

  private async rerunRiskScoring(jobId: string, userIds: string[]) {
    const riskService = new RiskService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const riskClassificationItem = await riskService.getRiskClassificationItem()
    const riskClassificationValues = riskClassificationItem.classificationValues

    const logicEvaluator = new LogicEvaluator(
      this.tenantId,
      this.dynamoDb,
      'DYNAMODB'
    )

    const riskScoringService = new RiskScoringV8Service(
      this.tenantId,
      logicEvaluator,
      { dynamoDb: this.dynamoDb, mongoDb: this.mongoDb }
    )

    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const users = await userRepository.getUsersByIds(userIds)
    const tenantSettings = await tenantRepository.getTenantSettings()

    await pMap(
      users,
      async (user) => {
        const [drsScore, krsScore, avgArsScore] = await Promise.all([
          riskScoringService.getDrsScore(user.userId),
          riskScoringService.getKrsScore(user.userId),
          riskService.getAverageArsScore(user.userId),
        ])

        if (drsScore?.isUpdatable === false || krsScore?.isLocked === true) {
          logger.info(
            `Skipping user ${user.userId} because drsScore is not updatable or krsScore is locked`
          )
          return
        }

        if (krsScore?.manualRiskLevel) {
          logger.info(`User has manual risk level set`)
        }
        // Todo: Check whether to fetch last event
        const newKrsScore = await riskScoringService.calculateAndUpdateKrsScore(
          user,
          riskClassificationValues,
          undefined,
          krsScore?.manualRiskLevel,
          krsScore,
          false
        )
        if (newKrsScore.isOverriddenScore) {
          await riskScoringService.updateDrsScore({
            userId: user.userId,
            drsScore: newKrsScore.score,
            transactionId: 'RISK_SCORING_RERUN',
            factorScoreDetails: newKrsScore.scoreDetails,
            components: newKrsScore.components,
          })
          return
        }
        const newDrsScore = riskScoringService.calculateNewDrsScore({
          algorithm: tenantSettings.riskScoringAlgorithm || {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: drsScore?.drsScore,
          krsScore: newKrsScore.score,
          avgArsScore: avgArsScore?.value,
        })

        await riskScoringService.updateDrsScore({
          userId: user.userId,
          drsScore: newDrsScore,
          transactionId: 'RISK_SCORING_RERUN',
          factorScoreDetails: newKrsScore.scoreDetails,
          components: newKrsScore.components,
        })
      },
      { concurrency: 10 }
    )

    await this.incrementProcessedUserCount(jobId, userIds.length)
  }

  public async incrementProcessedUserCount(
    jobId: string,
    incrementCount: number
  ) {
    const repository = new BatchRerunUsersRepository(
      this.tenantId,
      this.dynamoDb
    )
    await repository.incrementJobProcessedCount(jobId, incrementCount)
  }

  public async incrementSentUserCount(jobId: string, incrementCount: number) {
    const repository = new BatchRerunUsersRepository(
      this.tenantId,
      this.dynamoDb
    )
    await repository.incrementJobSentCount(jobId, incrementCount)
  }

  public async getJobProgress(jobId: string) {
    const repository = new BatchRerunUsersRepository(
      this.tenantId,
      this.dynamoDb
    )
    return repository.getJobProgress(jobId)
  }

  public async createJobProgress(jobId: string) {
    const repository = new BatchRerunUsersRepository(
      this.tenantId,
      this.dynamoDb
    )
    await repository.createJobProgress(jobId)
  }

  public async toRerunRiskScoring(): Promise<{
    isError: boolean
    error: string
  }> {
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const tenantSettings = await tenantRepository.getTenantSettings()
    if (!tenantSettings.features?.includes('RISK_SCORING')) {
      return {
        isError: true,
        error: 'Risk scoring is not enabled for this tenant',
      }
    }
    const status = await this.getBatchJobBulkRerunRiskScoringStatus()
    if (status.isAnyJobRunning) {
      return {
        isError: true,
        error: 'A bulk rerun risk scoring job is already running',
      }
    }

    if (
      tenantSettings.limits?.rerunRiskScoringLimit &&
      status.count >= tenantSettings.limits.rerunRiskScoringLimit
    ) {
      return {
        isError: true,
        error: 'Bulk rerun risk scoring limit reached',
      }
    }

    if (
      tenantSettings.riskScoringAlgorithm?.type === 'FORMULA_LEGACY_MOVING_AVG'
    ) {
      return {
        error:
          'Legacy moving average risk scoring is not supported for bulk rerun',
        isError: true,
      }
    }

    return { isError: false, error: 'No error' }
  }

  public async getBatchJobBulkRerunRiskScoringStatus() {
    const batchJobRepository = new BatchJobRepository(
      this.tenantId,
      this.mongoDb
    )

    const isAnyJobRunning = await batchJobRepository.isAnyJobRunning(
      'BATCH_RERUN_USERS',
      { 'parameters.jobType': 'RERUN_RISK_SCORING' }
    )
    const count = await batchJobRepository.getJobsCount('BATCH_RERUN_USERS', {
      'parameters.jobType': 'RERUN_RISK_SCORING',
      'latestStatus.status': { $in: ['PENDING', 'IN_PROGRESS', 'SUCCESS'] },
    })

    const latestJob = await batchJobRepository.getLatestJob({
      type: 'BATCH_RERUN_USERS',
      'parameters.jobType': 'RERUN_RISK_SCORING',
      'latestStatus.status': { $in: ['PENDING', 'IN_PROGRESS'] },
    })
    const jobId = latestJob?.jobId

    if (!jobId) {
      return { count, isAnyJobRunning: false }
    }

    const jobProgress = await this.getJobProgress(jobId)

    const isJobRunning =
      jobProgress?.sentCount != null &&
      jobProgress?.sentCount !== jobProgress?.processedCount

    return {
      count,
      isAnyJobRunning: isAnyJobRunning || isJobRunning,
      ...(isJobRunning
        ? {
            sentCount: jobProgress?.sentCount ?? 0,
            processedCount: jobProgress?.processedCount ?? 0,
          }
        : {}),
    }
  }
}
