import { FlatFileRunner } from './index'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { FlatFileValidationResult } from '@/@types/flat-files'
import { RiskService } from '@/services/risk'
import { memoizePromise } from '@/utils/memoize'
import { isDefaultRiskFactor } from '@/services/risk-scoring/utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export class RiskFactorsImportRunner extends FlatFileRunner<RiskFactor> {
  model = RiskFactor
  public concurrency = 10

  private getAllRiskFactors = memoizePromise(async () => {
    const mongoDb = await getMongoDbClient()
    const riskService = new RiskService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb,
    })
    return riskService.getAllRiskFactors()
  })

  protected async _run(data: RiskFactor): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const riskService = new RiskService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb,
    })

    const allRiskFactors = await this.getAllRiskFactors()
    const isDefaultFactor = isDefaultRiskFactor(data)

    const riskFactor: RiskFactor = data

    delete riskFactor.createdAt
    delete riskFactor.updatedAt

    if (isDefaultFactor) {
      const existingRiskFactor = allRiskFactors.find(
        (factor) => factor.parameter === data.parameter
      )

      if (existingRiskFactor) {
        riskFactor.riskFactorId = existingRiskFactor?.riskFactorId
        riskFactor.id = existingRiskFactor?.id as string
      }
    } else {
      delete riskFactor.riskFactorId
      delete (riskFactor as any).id
    }

    await riskService.createOrUpdateRiskFactor(riskFactor)
  }

  async validate(): Promise<
    Pick<FlatFileValidationResult, 'valid' | 'errors'>
  > {
    return {
      valid: true,
      errors: [],
    }
  }
}
