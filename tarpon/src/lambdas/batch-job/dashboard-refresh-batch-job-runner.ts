import { BatchJobRunner } from './batch-job-runner-base'
import { DashboardRefreshBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

export class DashboardRefreshBatchJobRunner extends BatchJobRunner {
  protected async run(job: DashboardRefreshBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const dashboardStatsRepository = new DashboardStatsRepository(
      job.tenantId,
      {
        mongoDb,
      }
    )
    const refreshJobs: Promise<void>[] = []

    if (job.parameters.cases) {
      refreshJobs.push(
        dashboardStatsRepository.refreshCaseStats(job.parameters.cases)
      )
    }
    if (job.parameters.transactions) {
      refreshJobs.push(
        dashboardStatsRepository.refreshTransactionStats(
          job.parameters.transactions
        )
      )
    }
    if (job.parameters.users) {
      refreshJobs.push(dashboardStatsRepository.refreshUserStats())
    }
    await Promise.all(refreshJobs)
  }
}
