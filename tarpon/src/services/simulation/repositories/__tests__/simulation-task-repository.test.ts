import { createSimulationTask, getSimulationTaskRepository } from './utils'
import { SimulationRiskLevelsType } from '@/@types/openapi-internal/SimulationRiskLevelsType'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { SimulationRiskLevelsStatisticsResult } from '@/@types/openapi-internal/SimulationRiskLevelsStatisticsResult'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

dynamoDbSetupHook()

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('SimulationTaskRepository', () => {
    it('should create a simulation task', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      expect(res).toBeDefined()
      const simulationTaskFromDb = await repository.getSimulationJob(res.jobId)
      expect(simulationTaskFromDb).toBeDefined()
      expect(simulationTaskFromDb?.iterations).toBeDefined()
      expect(simulationTaskFromDb?.iterations.length).toBe(1)
      expect(simulationTaskFromDb?.type).toEqual(simulationTask.type)
      expect(simulationTaskFromDb?.createdAt).toBeDefined()
      expect(simulationTaskFromDb?.createdBy).toBeDefined()
    })
    it('should update statistics', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      const statistics = {
        totalUsers: 100,
        totalTransactions: 1000,
        totalAmount: 100000,
      }
      await repository.updateStatistics(
        res.jobId,
        statistics as SimulationRiskLevelsStatisticsResult
      )
    })
    it('should update task status', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      await repository.updateTaskStatus(res.taskIds[0], 'SUCCESS', 100, 1000)
      const result = await repository.getSimulationJob(res.jobId)
      expect(result).toBeDefined()
      expect(result?.iterations[0].latestStatus.status).toBe('SUCCESS')
      expect(result?.iterations[0].progress).toBe(100)
      expect(result?.iterations[0].totalEntities).toBe(1000)
    })
    it('should get simulation job', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      const result = await repository.getSimulationJob(res.jobId)
      expect(result).toBeDefined()
      expect(result?.type).toBe(simulationTask.type)
      expect(result?.createdAt).toBeDefined()
      expect(result?.createdBy).toBeDefined()
    })
    it('should get simulation jobs', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      const result = await repository.getSimulationJobs({
        page: 1,
        type: 'PULSE',
      })
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.data.length).toBe(1)
      expect(result.data[0].type).toBe(simulationTask.type)
      expect(result.data[0].createdAt).toBeDefined()
      expect(result.data[0].createdBy).toBeDefined()
      expect(result.data[0].iterations).toBeDefined()
      expect(result.data[0].iterations.length).toBe(1)
      expect(result.data[0].iterations[0].taskId).toBe(res.taskIds[0])
    })
    it('should get simulation jobs count', async () => {
      const tenantId = getTestTenantId()
      const repository = await getSimulationTaskRepository(tenantId)
      const simulationTask = createSimulationTask({
        type: 'PULSE' as SimulationRiskLevelsType,
      })
      const res = await repository.createSimulationJob(simulationTask)
      expect(res).toBeDefined()
      const result = await repository.getSimulationJobsCount()
      expect(result).toBeDefined()
      expect(result).toBe(1)
    })
  })
})
