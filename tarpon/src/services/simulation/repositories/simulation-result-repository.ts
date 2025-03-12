import { AggregationCursor, Filter, MongoClient, Document } from 'mongodb'
import pMap from 'p-map'
import { paginatePipeline, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { SimulationRiskFactorsResult } from '@/@types/openapi-internal/SimulationRiskFactorsResult'
import { SimulationRiskLevelsAndRiskFactorsResultResponse } from '@/@types/openapi-internal/SimulationRiskLevelsAndRiskFactorsResultResponse'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'
import { COUNT_QUERY_LIMIT, OptionalPagination } from '@/utils/pagination'
import { isDemoMode } from '@/utils/demo'

type SimulationResult =
  | SimulationRiskLevelsResult
  | SimulationRiskFactorsResult
  | SimulationV8RiskFactorsResult

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
    const collection = db.collection<SimulationResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )

    if (isDemoMode()) {
      await pMap(
        results as SimulationResult[],
        async (result) => {
          await collection.replaceOne(
            { taskId: result.taskId, userId: result.userId },
            result,
            { upsert: true }
          )
        },
        { concurrency: 100 }
      )
    } else {
      await collection.insertMany(results)
    }
  }

  private async getSimulationConditions(
    params: OptionalPagination<DefaultApiGetSimulationTaskIdResultRequest>
  ): Promise<Filter<SimulationResult>[]> {
    const conditions: Filter<SimulationResult>[] = []

    if (params.taskId) {
      conditions.push({ taskId: params.taskId })
    }

    if (params.filterId) {
      conditions.push({ caseId: prefixRegexMatchFilter(params.filterId) })
    }

    if (
      params.filterCurrentKrsLevel &&
      params.filterCurrentKrsLevel.length > 0
    ) {
      conditions.push({
        'current.krs.riskLevel': { $in: params.filterCurrentKrsLevel },
      })
    }

    if (
      params.filterSimulationKrsLevel &&
      params.filterSimulationKrsLevel.length > 0
    ) {
      conditions.push({
        'simulated.krs.riskLevel': { $in: params.filterSimulationKrsLevel },
      })
    }

    if (
      params.filterCurrentDrsLevel &&
      params.filterCurrentDrsLevel.length > 0
    ) {
      conditions.push({
        'current.drs.riskLevel': { $in: params.filterCurrentDrsLevel },
      })
    }

    if (
      params.filterSimulationDrsLevel &&
      params.filterSimulationDrsLevel.length > 0
    ) {
      conditions.push({
        'simulated.drs.riskLevel': { $in: params.filterSimulationDrsLevel },
      })
    }

    return conditions
  }

  private async getSimulationCount(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )
    const conditions = await this.getSimulationConditions(params)
    const count = await collection.countDocuments(
      conditions.length > 0 ? { $and: conditions } : {},
      { limit: COUNT_QUERY_LIMIT }
    )
    return count
  }

  private async getSimulationMongoPipeline(
    params: OptionalPagination<DefaultApiGetSimulationTaskIdResultRequest>
  ): Promise<{
    preLimitPipeline: Document[]
    postLimitPipeline: Document[]
  }> {
    const sortField =
      params?.sortField !== undefined && params?.sortField !== 'undefined'
        ? params?.sortField
        : 'userId'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const conditions = await this.getSimulationConditions(params)

    const filter = conditions.length > 0 ? { $and: conditions } : {}

    const preLimitPipeline: Document[] = []
    const postLimitPipeline: Document[] = []

    preLimitPipeline.push({ $match: filter })

    preLimitPipeline.push({ $sort: { [sortField]: sortOrder, _id: 1 } })

    postLimitPipeline.push({
      $project: {
        _id: 0,
      },
    })

    return { preLimitPipeline, postLimitPipeline }
  }

  private getDenormalizedSimulation(pipeline: Document[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationResult>(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )
    return collection.aggregate<SimulationResult>(pipeline, {
      allowDiskUse: true,
    })
  }

  private async getSimulationCursor(
    params: OptionalPagination<DefaultApiGetSimulationTaskIdResultRequest>
  ): Promise<AggregationCursor<SimulationResult>> {
    const { preLimitPipeline, postLimitPipeline } =
      await this.getSimulationMongoPipeline(params)

    postLimitPipeline.push(...paginatePipeline(params))
    return this.getDenormalizedSimulation(
      preLimitPipeline.concat(postLimitPipeline)
    )
  }

  public async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<SimulationRiskLevelsAndRiskFactorsResultResponse> {
    const cursor = await this.getSimulationCursor(params)
    const total = this.getSimulationCount(params)

    return {
      total: await total,
      items: await cursor.toArray(),
    }
  }
}
