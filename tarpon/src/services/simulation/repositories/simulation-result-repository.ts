import { MongoClient } from 'mongodb'

import { omit } from 'lodash'
import { paginateFindOptions } from '@/utils/mongodb-utils'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { SimulationRiskFactorsResult } from '@/@types/openapi-internal/SimulationRiskFactorsResult'
import { SimulationRiskLevelsAndRiskFactorsResultResponse } from '@/@types/openapi-internal/SimulationRiskLevelsAndRiskFactorsResultResponse'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'

@traceable
export class SimulationResultRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSimulationResults(
    results:
      | SimulationRiskLevelsResult[]
      | SimulationRiskFactorsResult[]
      | SimulationV8RiskFactorsResult[]
  ): Promise<void> {
    if (results.length === 0) {
      return
    }
    const db = this.mongoDb.db()
    const collection = db.collection<
      | SimulationRiskLevelsResult
      | SimulationRiskFactorsResult
      | SimulationV8RiskFactorsResult
    >(SIMULATION_RESULT_COLLECTION(this.tenantId))

    await collection.insertMany(results)
  }

  public async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<SimulationRiskLevelsAndRiskFactorsResultResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      | SimulationRiskLevelsResult
      | SimulationRiskFactorsResult
      | SimulationV8RiskFactorsResult
    >(SIMULATION_RESULT_COLLECTION(this.tenantId))

    const items = await collection
      .find(
        { taskId: params.taskId },
        {
          sort: {
            [params.sortField ?? 'userId']:
              params.sortOrder === 'ascend' ? 1 : -1,
          },
          ...paginateFindOptions({
            page: params.page,
            pageSize: params.pageSize,
          }),
        }
      )
      .toArray()

    const count = await collection.countDocuments({ taskId: params.taskId })

    return {
      items: items.map((result) => omit(result, '_id')),
      total: count,
    }
  }
}
