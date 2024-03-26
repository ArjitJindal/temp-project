import { MongoClient } from 'mongodb'

import { omit } from 'lodash'
import { paginateFindOptions } from '@/utils/mongodb-utils'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { SimulationRiskFactorsResult } from '@/@types/openapi-internal/SimulationRiskFactorsResult'

@traceable
export class SimulationResultRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSimulationResults(
    results: SimulationRiskLevelsResult[] | SimulationRiskFactorsResult[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      SimulationRiskLevelsResult | SimulationRiskFactorsResult
    >(SIMULATION_RESULT_COLLECTION(this.tenantId))

    await collection.insertMany(results)
  }

  public async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<{ items: SimulationRiskLevelsResult[]; total: number }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationRiskLevelsResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )

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
