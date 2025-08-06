import { ConnectionCredentials, WithOperators } from 'thunder-schema'
import { BatchJobFilterUtils } from './filter-utils'
import { traceable } from '@/core/xray'
import { BatchJobInDb, BatchJobParams, BatchJobType } from '@/@types/batch-job'
import { getClickhouseCredentials } from '@/utils/clickhouse/utils'
import { BatchJobTable } from '@/models/batch-job'
import { TaskStatusChangeStatusEnum } from '@/@types/openapi-internal/TaskStatusChangeStatusEnum'

@traceable
export class BatchJobClickhouseRepository {
  private readonly credentials: Promise<ConnectionCredentials>
  private batchJobTable?: BatchJobTable

  constructor(tenantId: string) {
    this.credentials = getClickhouseCredentials(tenantId)
  }

  private async getBatchJobTable() {
    if (this.batchJobTable) {
      return this.batchJobTable
    }
    const credentials = await this.credentials
    this.batchJobTable = new BatchJobTable({
      credentials,
    })
    return this.batchJobTable
  }

  public async linkClickhouseJob(jobs: BatchJobInDb[]): Promise<void> {
    const batchJobTable = await this.getBatchJobTable()
    for (const job of jobs) {
      await batchJobTable.create(job).save()
    }
  }

  public async getJobById(jobId: string): Promise<BatchJobInDb | null> {
    const batchJobTable = await this.getBatchJobTable()
    return (
      (await batchJobTable.objects.filter({ jobId }).final().all())[0] ?? null
    )
  }

  public async getJobsByStatus(params: {
    latestStatuses: TaskStatusChangeStatusEnum[]
    filterTypes?: BatchJobType[]
  }): Promise<BatchJobInDb[]> {
    const batchJobTable = await this.getBatchJobTable()
    const filters: Partial<WithOperators<BatchJobInDb>> = {}
    if (params.latestStatuses.length > 0) {
      filters.latestStatus = {
        status__in: params.latestStatuses,
      }
    }
    if (params.filterTypes) {
      filters.type__in = params.filterTypes as any
    }
    return await batchJobTable.objects.filter(filters).final().all()
  }

  public async getJobs(
    filters: BatchJobParams,
    limit: number = 20
  ): Promise<BatchJobInDb[]> {
    const batchJobTable = await this.getBatchJobTable()
    const clickhouseFilters = new BatchJobFilterUtils().buildClickhouseFilters(
      filters
    )
    return await batchJobTable.objects
      .filter(clickhouseFilters)
      .sort({
        latestStatus: {
          timestamp: -1,
        },
      })
      .limit(limit)
      .final()
      .all()
  }
}
