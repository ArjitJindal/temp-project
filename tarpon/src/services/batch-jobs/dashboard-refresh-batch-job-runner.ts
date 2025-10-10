import last from 'lodash/last'
import uniq from 'lodash/uniq'
import { BatchJobRunner } from './batch-job-runner-base'
import { DashboardRefreshBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { Case } from '@/@types/openapi-internal/Case'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getAffectedInterval } from '@/services/dashboard/utils'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { getDynamoDbClient } from '@/utils/dynamodb'

function getTargetTimeRanges(timestamps: number[]): TimeRange[] {
  if (timestamps.length === 0) {
    return []
  }
  const sortedHourTimeRanges: TimeRange[] = uniq(
    timestamps.map(
      (t) => getAffectedInterval({ startTimestamp: t }, 'HOUR').start
    )
  )
    .sort()
    .map((t) => ({
      startTimestamp: t,
      endTimestamp: dayjs(t).add(1, 'hour').valueOf(),
    }))
  const mergedTimeRanges: TimeRange[] = []
  for (const timeRange of sortedHourTimeRanges) {
    const lastTimeRange = last(mergedTimeRanges)
    if (
      lastTimeRange &&
      timeRange.startTimestamp === lastTimeRange.endTimestamp
    ) {
      lastTimeRange.endTimestamp = timeRange.endTimestamp
    } else {
      mergedTimeRanges.push(timeRange)
    }
  }
  return mergedTimeRanges
}

@traceable
export class DashboardRefreshBatchJobRunner extends BatchJobRunner {
  protected async run(job: DashboardRefreshBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const db = mongoDb.db()
    const dashboardStatsRepository = new DashboardStatsRepository(
      job.tenantId,
      { mongoDb, dynamoDb }
    )
    const { checkTimeRange } = job.parameters
    const refreshJobs = [
      // Alerts stats
      (async () => {
        const casesCollection = db.collection<Case>(
          CASES_COLLECTION(job.tenantId)
        )
        const checkTimeRangeCondition = {
          'alerts.updatedAt': {
            $gte: checkTimeRange?.startTimestamp ?? 0,
            $lt: checkTimeRange?.endTimestamp ?? Number.MAX_SAFE_INTEGER,
          },
        }
        const alerts = await casesCollection
          .aggregate([
            {
              $match: checkTimeRangeCondition,
            },
            {
              $unwind: '$alerts',
            },
            {
              $match: checkTimeRangeCondition,
            },
            {
              $project: {
                alert: '$alerts',
              },
            },
          ])
          .toArray()
        const createdAtTargetTimeRanges = getTargetTimeRanges(
          alerts.map((alert) => alert.alert.createdTimestamp ?? 0)
        )

        const updatedAtTargetTimeRanges = getTargetTimeRanges(
          alerts.map((alert) => alert.alert.updatedAt ?? 0)
        )

        for (const timeRange of createdAtTargetTimeRanges) {
          await dashboardStatsRepository.refreshAlertsStats(timeRange)
          logger.info(`Refreshed alerts stats - ${JSON.stringify(timeRange)}`)
        }

        for (const timeRange of updatedAtTargetTimeRanges) {
          await dashboardStatsRepository.refreshQaStats(timeRange)
          logger.info(`Refreshed QA stats - ${JSON.stringify(timeRange)}`)
        }
      })(),

      // Team stats
      (async () => {
        await dashboardStatsRepository.refreshTeamStats(
          dynamoDb,
          checkTimeRange
        )
        logger.info(`Refreshed team stats - ${JSON.stringify(checkTimeRange)}`)
        await dashboardStatsRepository.refreshLatestTeamStats()
        logger.info(`Refreshed latest team stats`)
        await dashboardStatsRepository.refreshSLATeamStats(checkTimeRange)
        logger.info(
          `Refreshed SLA team stats - ${JSON.stringify(checkTimeRange)}`
        )
      })(),

      // Transaction stats
      (async () => {
        const transactionsCollection = db.collection<InternalTransaction>(
          TRANSACTIONS_COLLECTION(job.tenantId)
        )
        const transactions = await (
          await transactionsCollection.find(
            {
              updatedAt: {
                $gte: checkTimeRange?.startTimestamp ?? 0,
                $lt: checkTimeRange?.endTimestamp ?? Number.MAX_SAFE_INTEGER,
              },
            },
            { projection: { timestamp: 1 } }
          )
        ).toArray()
        const targetTimeRanges = getTargetTimeRanges(
          transactions.map((t) => t.timestamp)
        )
        for (const timeRange of targetTimeRanges) {
          await dashboardStatsRepository.refreshTransactionStats(timeRange)
          logger.info(
            `Refreshed transaction stats - ${JSON.stringify(timeRange)}`
          )
        }
      })(),

      // User stats
      (async () => {
        const usersCollection = db.collection<InternalUser>(
          USERS_COLLECTION(job.tenantId)
        )
        const users = await (
          await usersCollection.find(
            {
              updatedAt: {
                $gte: checkTimeRange?.startTimestamp ?? 0,
                $lt: checkTimeRange?.endTimestamp ?? Number.MAX_SAFE_INTEGER,
              },
            },
            { projection: { createdTimestamp: 1 } }
          )
        ).toArray()
        const targetTimeRanges = getTargetTimeRanges(
          users.map((c) => c.createdTimestamp ?? 0)
        )

        for (const timeRange of targetTimeRanges) {
          await dashboardStatsRepository.refreshUserStats(timeRange)
          logger.info(`Refreshed user stats - ${JSON.stringify(timeRange)}`)
        }
      })(),
    ]

    await Promise.all(refreshJobs)
  }
}
