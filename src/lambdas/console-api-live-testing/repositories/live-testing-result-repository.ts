import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { LIVE_TESTING_RESULT_COLLECTION } from '@/utils/mongoDBUtils'
import { LiveTestPulseResult } from '@/@types/openapi-internal/LiveTestPulseResult'

export class LiveTestingResultRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveLiveTestingResults(
    results: LiveTestPulseResult[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseResult>(
      LIVE_TESTING_RESULT_COLLECTION(this.tenantId)
    )
    await collection.insertMany(results)
  }

  public async getLiveTestingResults(
    taskId: string
  ): Promise<LiveTestPulseResult[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseResult>(
      LIVE_TESTING_RESULT_COLLECTION(this.tenantId)
    )
    return (await collection.find({ taskId }).toArray()).map((result) =>
      _.omit(result, '_id')
    )
  }
}
