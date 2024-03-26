import { Filter, MongoClient } from 'mongodb'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { MerchantRepository } from '@/lambdas/console-api-merchant/merchant-repository'
import { traceable } from '@/core/xray'

@traceable
export class MerchantMonitoringRetrieve {
  private merchantRepository: MerchantRepository

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.merchantRepository = new MerchantRepository(tenantId, {
      mongoDb: connections.mongoDb,
    })
  }

  async getMerchantMonitoringHistory(
    source: MerchantMonitoringSource,
    userId: string,
    filter?: Filter<MerchantMonitoringSummary>,
    limit?: number
  ): Promise<MerchantMonitoringSummary[]> {
    return await this.merchantRepository.getSummaryHistory(
      userId,
      source,
      filter,
      limit
    )
  }
}
