import { last, uniq } from 'lodash'
import { ShadowRuleStatsAnalytics } from '../analytics/rules/shadow-rule-stats'
import { BatchJobRunner } from './batch-job-runner-base'
import { DashboardRefreshBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { Case } from '@/@types/openapi-internal/Case'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getAffectedInterval } from '@/services/dashboard/utils'
import { TimeRange } from '@/services/dashboard/repositories/types'

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
    const db = mongoDb.db()
    const dashboardStatsRepository = new DashboardStatsRepository(
      job.tenantId,
      {
        mongoDb,
      }
    )
    const { checkTimeRange } = job.parameters
    const refreshJobs = [
      // Case stats
      (async () => {
        const casesCollection = db.collection<Case>(
          CASES_COLLECTION(job.tenantId)
        )
        const cases = await casesCollection
          .find(
            {
              updatedAt: {
                $gte: checkTimeRange?.startTimestamp ?? 0,
                $lt: checkTimeRange?.endTimestamp ?? Number.MAX_SAFE_INTEGER,
              },
            },
            { projection: { createdTimestamp: 1 } }
          )
          .toArray()

        const targetTimeRanges = getTargetTimeRanges(
          cases.map((c) => c.createdTimestamp ?? 0)
        )

        for (const timeRange of targetTimeRanges) {
          await dashboardStatsRepository.refreshCaseStats(timeRange)
          await dashboardStatsRepository.refreshLatestTeamStats()
          logger.info(`Refreshed case stats - ${JSON.stringify(timeRange)}`)
        }
      })(),

      // Team stats
      (async () => {
        await dashboardStatsRepository.refreshTeamStats(checkTimeRange)
        logger.info(`Refreshed team stats - ${JSON.stringify(checkTimeRange)}`)
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

      // RuleInstance stats
      (async () => {
        await ShadowRuleStatsAnalytics.refresh(job.tenantId, checkTimeRange)
        logger.info(
          `Refreshed rule instance stats - ${JSON.stringify(checkTimeRange)}`
        )
      })(),
    ]

    await Promise.all(refreshJobs)
  }
}
