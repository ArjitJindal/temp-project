import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongoDBUtils'
import { SimulationPulseResult } from '@/@types/openapi-internal/SimulationPulseResult'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'

export class SimulationResultRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSimulationResults(
    results: SimulationPulseResult[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )
    await collection.insertMany(results)
  }

  public async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<{ items: SimulationPulseResult[]; total: number }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )
    const page = parseInt(`${params.page ?? '1'}`)
    const pageSize = parseInt(`${params.pageSize ?? '20'}`)

    const items = await collection
      .find({ taskId: params.taskId })
      .sort({
        [params.sortField ?? 'userId']: params.sortOrder === 'ascend' ? 1 : -1,
      })
      .limit(pageSize)
      .skip((page - 1) * pageSize)
      .toArray()

    const count = await collection.countDocuments({ taskId: params.taskId })

    return {
      items: items.map((result) => _.omit(result, '_id')),
      total: count,
    }
  }
}
