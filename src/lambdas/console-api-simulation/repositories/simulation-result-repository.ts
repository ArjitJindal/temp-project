import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongoDBUtils'
import { SimulationPulseResult } from '@/@types/openapi-internal/SimulationPulseResult'

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
    taskId: string
  ): Promise<SimulationPulseResult[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )
    return (await collection.find({ taskId }).toArray()).map((result) =>
      _.omit(result, '_id')
    )
  }
}
