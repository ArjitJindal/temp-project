import { MongoClient } from 'mongodb'
import { BadRequest } from 'http-errors'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { tenantSettings } from '@/core/utils/context'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { SimulationBeaconParametersRequest } from '@/@types/openapi-internal/SimulationBeaconParametersRequest'
import { isDemoTenant } from '@/utils/tenant'
import { traceable } from '@/core/xray'
import {
  DefaultApiGetSimulationsRequest,
  DefaultApiGetSimulationTaskIdResultRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { SimulationResultRepository } from '@/services/simulation/repositories/simulation-result-repository'
import { SimulationRiskLevelsParametersRequest } from '@/@types/openapi-internal/SimulationRiskLevelsParametersRequest'
import { SimulationRiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationRiskFactorsParametersRequest'
import { SimulationV8RiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationV8RiskFactorsParametersRequest'

type SimulationParameters =
  | SimulationRiskLevelsParametersRequest
  | SimulationRiskFactorsParametersRequest
  | SimulationBeaconParametersRequest
  | SimulationV8RiskFactorsParametersRequest

@traceable
export class SimulationService {
  tenantId: string
  mongoDb: MongoClient
  simulationTaskRepository: SimulationTaskRepository
  simulationResultRepository: SimulationResultRepository

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      connections.mongoDb
    )
    this.simulationResultRepository = new SimulationResultRepository(
      tenantId,
      connections.mongoDb
    )
  }

  async createSimulation(parameters: SimulationParameters) {
    const settings = await tenantSettings(this.tenantId)
    const simulationsLimit = settings.limits?.simulations ?? 0
    const usedSimulations =
      await this.simulationTaskRepository.getSimulationJobsCount()
    if (
      usedSimulations >= simulationsLimit &&
      process.env.NODE_ENV !== 'test'
    ) {
      throw new BadRequest('Simulations Limit Reached')
    }
    const { taskIds, jobId } =
      await this.simulationTaskRepository.createSimulationJob(parameters)
    if (parameters.type === 'BEACON') {
      const defaultRuleInstance = parameters.defaultRuleInstance
      if (defaultRuleInstance.type === 'USER') {
        throw new BadRequest('User rule is not supported for beacon simulation')
      }
    }
    for (let i = 0; i < taskIds.length; i++) {
      if (taskIds[i] && parameters.parameters[i]) {
        if (parameters.type === 'BEACON' && !isDemoTenant(this.tenantId)) {
          await sendBatchJobCommand({
            type: 'SIMULATION_BEACON',
            tenantId: this.tenantId,
            parameters: {
              taskId: taskIds[i],
              jobId,
              defaultRuleInstance: parameters.defaultRuleInstance,
              ...parameters.parameters[i],
            },
          })
        }

        if (parameters.type === 'PULSE') {
          await sendBatchJobCommand({
            type: 'SIMULATION_PULSE',
            tenantId: this.tenantId,
            parameters: {
              taskId: taskIds[i],
              jobId,
              ...parameters.parameters[i],
            },
          })
        }
        if (parameters.type === 'RISK_FACTORS') {
          await sendBatchJobCommand({
            type: 'SIMULATION_RISK_FACTORS',
            tenantId: this.tenantId,
            parameters: {
              taskId: taskIds[i],
              jobId,
              sampling: parameters.sampling ?? {
                usersCount: 'RANDOM',
              },
            },
          })
        }
        if (parameters.type === 'RISK_FACTORS_V8') {
          await sendBatchJobCommand({
            type: 'SIMULATION_RISK_FACTORS_V8',
            tenantId: this.tenantId,
            parameters: {
              taskId: taskIds[i],
              jobId,
              sampling: parameters.sampling ?? {
                usersCount: 'RANDOM',
              },
            },
          })
        }
      }
    }
    return { taskIds, jobId }
  }

  async getSimulationJobs(params: DefaultApiGetSimulationsRequest) {
    return await this.simulationTaskRepository.getSimulationJobs(params)
  }

  async getSimulationJob(jobId: string) {
    return await this.simulationTaskRepository.getSimulationJob(jobId)
  }

  async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ) {
    return await this.simulationResultRepository.getSimulationResults(params)
  }

  async getSimulationJobsCount(): Promise<{ runJobsCount: number }> {
    return {
      runJobsCount:
        await this.simulationTaskRepository.getSimulationJobsCount(),
    }
  }
}
