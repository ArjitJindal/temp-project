import { SimulationResultRepository } from '../simulation-result-repository'
import { SimulationTaskRepository } from '../simulation-task-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SimulationRiskLevelsParametersRequest } from '@/@types/openapi-internal/SimulationRiskLevelsParametersRequest'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { SimulationRiskLevelsType } from '@/@types/openapi-internal/SimulationRiskLevelsType'

export async function getSimulationResultRepository(tenantId: string) {
  return new SimulationResultRepository(tenantId, await getMongoDbClient())
}

export async function getSimulationTaskRepository(tenantId: string) {
  return new SimulationTaskRepository(tenantId, await getMongoDbClient())
}

export const createSimulationTask = (
  overrides: Partial<SimulationRiskLevelsParametersRequest>
) => {
  return {
    type: 'PULSE' as SimulationRiskLevelsType,
    parameters: [
      {
        type: 'PULSE' as SimulationRiskLevelsType,
        classificationValues: [
          {
            riskLevel: 'VERY_LOW' as RiskLevel,
            lowerBoundRiskScore: 0,
            upperBoundRiskScore: 15,
          },
          {
            riskLevel: 'LOW' as RiskLevel,
            lowerBoundRiskScore: 15,
            upperBoundRiskScore: 27,
          },
          {
            riskLevel: 'MEDIUM' as RiskLevel,
            lowerBoundRiskScore: 27,
            upperBoundRiskScore: 37,
          },
          {
            riskLevel: 'HIGH' as RiskLevel,
            lowerBoundRiskScore: 37,
            upperBoundRiskScore: 89,
          },
          {
            riskLevel: 'VERY_HIGH' as RiskLevel,
            lowerBoundRiskScore: 89,
            upperBoundRiskScore: 100,
          },
        ],
        parameterAttributeRiskValues: [],
        sampling: {
          usersCount: 10000,
          userLatestTransactionsCount: 10000,
        },
        name: 'Iteration 1 test 1',
        description: '',
      },
    ],
    statistics: {
      current: [
        {
          count: 8,
          riskType: 'KRS',
          riskLevel: 'HIGH' as RiskLevel,
        },
      ],
      simulated: [
        {
          count: 8,
          riskType: 'KRS',
          riskLevel: 'HIGH' as RiskLevel,
        },
      ],
    },
    defaultRiskClassifications: [
      {
        riskLevel: 'VERY_LOW' as RiskLevel,
        lowerBoundRiskScore: 0,
        upperBoundRiskScore: 15,
      },
    ],
    createdAt: new Date(),
    createdBy: 'test',
    ...overrides,
  }
}
