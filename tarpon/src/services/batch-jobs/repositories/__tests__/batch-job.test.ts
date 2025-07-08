import { v4 as uuidv4 } from 'uuid'
import { BatchJobRepository } from '../batch-job-repository'
import { getBatchJobRepository } from './utils'
import { createMockBatchJob } from './batch-job-mock-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

// --- Test Suite ---

dynamoDbSetupHook()

withFeaturesToggled([], ['CLICKHOUSE_MIGRATION', 'CLICKHOUSE_ENABLED'], () => {
  describe('BatchJobRepository', () => {
    let repository: BatchJobRepository
    let tenantId: string

    beforeEach(async () => {
      tenantId = getTestTenantId()
      repository = await getBatchJobRepository(tenantId)
    })

    it('should retrieve a job by its ID', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      const foundJob = await repository.getJobById(jobId)

      expect(foundJob).toBeDefined()
      expect(foundJob?.jobId).toEqual(job.jobId)
      expect(foundJob?.type).toEqual(job.type)
      expect(foundJob?.tenantId).toEqual(job.tenantId)
    })

    it('should retrieve jobs filtered by status', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      const pendingJobs = await repository.getJobsByStatus(['PENDING'])

      expect(pendingJobs).toHaveLength(1)
      expect(pendingJobs[0].jobId).toEqual(jobId)
      expect(pendingJobs[0].latestStatus.status).toEqual('PENDING')
    })

    it('should correctly update a job status', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      await repository.updateJobStatus(jobId, 'SUCCESS')
      const successfulJobs = await repository.getJobsByStatus(['SUCCESS'])
      expect(successfulJobs).toHaveLength(1)
      expect(successfulJobs[0].latestStatus.status).toEqual('SUCCESS')

      await repository.updateJobStatus(jobId, 'FAILED')
      const failedJobs = await repository.getJobsByStatus(['FAILED'])
      expect(failedJobs).toHaveLength(1)
      expect(failedJobs[0].latestStatus.status).toEqual('FAILED')
    })

    it('should retrieve all jobs when no filter is applied', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      const allJobs = await repository.getJobs({})

      expect(allJobs).toHaveLength(1)
      expect(allJobs[0].jobId).toEqual(jobId)
    })

    it('should filter jobs by type', async () => {
      const job1 = createMockBatchJob(
        uuidv4(),
        tenantId,
        'RULE_PRE_AGGREGATION'
      )
      const job2 = createMockBatchJob(
        uuidv4(),
        tenantId,
        'SANCTIONS_DATA_FETCH'
      )
      await repository.insertJob(job1)
      await repository.insertJob(job2)

      const ruleJobs = await repository.getJobs({
        type: 'RULE_PRE_AGGREGATION',
      })

      expect(ruleJobs).toHaveLength(1)
      expect(ruleJobs[0].jobId).toEqual(job1.jobId)
    })

    it('should filter jobs by latest status', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)
      await repository.updateJobStatus(jobId, 'SUCCESS')

      const successfulJobs = await repository.getJobs({
        latestStatus: { status: 'SUCCESS' },
      })

      expect(successfulJobs).toHaveLength(1)
      expect(successfulJobs[0].jobId).toEqual(jobId)
      expect(successfulJobs[0].latestStatus.status).toEqual('SUCCESS')
    })

    it('should filter jobs by a timestamp range on their latest status', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      const preTimestamp = Date.now()
      await repository.insertJob(job)

      await repository.updateJobStatus(jobId, 'SUCCESS')
      const postTimestamp = Date.now()

      const filteredJobs = await repository.getJobs({
        latestStatus: {
          latestStatusAfterTimestamp: preTimestamp,
          latestStatusBeforeTimestamp: postTimestamp,
        },
      })
      expect(filteredJobs).toHaveLength(1)
      expect(filteredJobs[0].jobId).toEqual(jobId)
    })

    it('should respect the limit parameter', async () => {
      const job1 = createMockBatchJob(
        uuidv4(),
        tenantId,
        'RULE_PRE_AGGREGATION'
      )
      const job2 = createMockBatchJob(
        uuidv4(),
        tenantId,
        'RULE_PRE_AGGREGATION'
      )
      await repository.insertJob(job1)
      await repository.insertJob(job2)

      const limitedJobs = await repository.getJobs({}, 1)

      expect(limitedJobs).toHaveLength(1)
    })

    it('should set job metadata', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)
      const newMetadata = { tasksCount: 10, completeTasksCount: 5 }

      await repository.setMetadata(jobId, newMetadata)
      const updatedJob = await repository.getJobById(jobId)

      expect(updatedJob?.metadata).toEqual(newMetadata)
    })

    it('should increment the completed tasks count', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      await repository.incrementCompleteTasksCount(jobId)
      const updatedJob = await repository.getJobById(jobId)

      expect(updatedJob?.metadata?.completeTasksCount).toEqual(1)
    })

    it('should increment the total tasks count in metadata', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job)

      await repository.incrementMetadataTasksCount(jobId, 10)
      const updatedJob = await repository.getJobById(jobId)

      expect(updatedJob?.metadata?.tasksCount).toEqual(10)
    })

    it('should update the job schedule and parameters', async () => {
      const jobId = uuidv4()
      const initialScheduledAt = 1735689600000
      const job = createMockBatchJob(jobId, tenantId, 'RULE_PRE_AGGREGATION')
      await repository.insertJob(job, initialScheduledAt)

      await repository.updateJobScheduleAndParameters(jobId, 10)
      const updatedJob = await repository.getJobById(jobId)

      expect(updatedJob?.latestStatus.scheduledAt).toEqual(
        initialScheduledAt + 10
      )
    })

    it('should check if any job is running', async () => {
      const jobId = uuidv4()
      const job = createMockBatchJob(jobId, tenantId, 'DEMO_MODE_DATA_LOAD')
      await repository.insertJob(job)

      const isRunning = await repository.isAnyJobRunning('DEMO_MODE_DATA_LOAD')
      expect(isRunning).toBe(true)
    })
    it('should check if no job is running', async () => {
      const isRunning = await repository.isAnyJobRunning('DEMO_MODE_DATA_LOAD')
      expect(isRunning).toBe(false)
    })
  })
})
