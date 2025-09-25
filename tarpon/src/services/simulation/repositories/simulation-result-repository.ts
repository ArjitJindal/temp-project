import { AggregationCursor, Filter, MongoClient, Document } from 'mongodb'
import pMap from 'p-map'
import { paginatePipeline, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { SIMULATION_RESULT_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'
import { COUNT_QUERY_LIMIT, OptionalPagination } from '@/utils/pagination'
import { SimulationBeaconTransactionResult } from '@/@types/openapi-internal/SimulationBeaconTransactionResult'
import { SimulationBeaconResultUser } from '@/@types/openapi-internal/SimulationBeaconResultUser'
import { isDemoTenant } from '@/utils/tenant-id'

type SimulationResult =
  | SimulationRiskLevelsResult
  | SimulationV8RiskFactorsResult
  | SimulationBeaconResultUser
  | SimulationBeaconTransactionResult

type SimulationResultReturnType = {
  total: number
  items: SimulationResult[]
}

@traceable
export class SimulationResultRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSimulationResults(
    results: SimulationResult[]
  ): Promise<void> {
    if (results.length === 0) {
      return
    }

    const db = this.mongoDb.db()
    const collection = db.collection(
      SIMULATION_RESULT_COLLECTION(this.tenantId)
    )

    if (isDemoTenant(this.tenantId)) {
      await pMap(
        results,
        async (result) => {
          const filter =
            'userId' in result
              ? { taskId: result.taskId, userId: result.userId }
              : { taskId: result.taskId, transactionId: result.transactionId }

          await collection.findOneAndReplace(filter, result, { upsert: true })
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

    if (params.filterTransactionId) {
      conditions.push({ transactionId: params.filterTransactionId })
    }

    if (params.filterUserId) {
      conditions.push({
        $or: [
          { 'originUser.userId': params.filterUserId },
          { 'destinationUser.userId': params.filterUserId },
          { userId: params.filterUserId },
        ],
      })
    }

    if (params.filterOriginPaymentMethod) {
      conditions.push({
        'originPaymentDetails.paymentMethod': params.filterOriginPaymentMethod,
      })
    }

    if (params.filterDestinationPaymentMethod) {
      conditions.push({
        'destinationPaymentDetails.paymentMethod':
          params.filterDestinationPaymentMethod,
      })
    }

    if (params.filterHitStatus) {
      conditions.push({
        hit: params.filterHitStatus,
      })
    }

    if (params.filterStartTimestamp && params.filterEndTimestamp) {
      conditions.push({
        timestamp: {
          $gte: params.filterStartTimestamp,
          $lte: params.filterEndTimestamp,
        },
      })
    }

    if (params.filterRuleAction) {
      conditions.push({
        action: params.filterRuleAction,
      })
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

    if (params.filterType) {
      conditions.push({
        type: params.filterType,
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
  ): Promise<SimulationResultReturnType> {
    return {
      total: await this.getSimulationCount(params),
      items: await (await this.getSimulationCursor(params)).toArray(),
    }
  }
}
