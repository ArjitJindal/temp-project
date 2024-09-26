import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { logger } from '@/core/logger'

// Todo: Make this generic for rules and risk factors
export async function riskFactorAggregationVariablesRebuild(
  riskFactor: RiskFactor,
  comparisonTime: number,
  tenantId: string,
  riskRepository: RiskRepository,
  options?: { updateRiskFactorStatus?: boolean }
) {
  const aggVarsToRebuild =
    riskFactor.logicAggregationVariables?.filter(
      (aggVar) => aggVar.version && aggVar.version >= comparisonTime
    ) ?? []
  const updateRuleInstanceStatus = options?.updateRiskFactorStatus ?? true

  if (aggVarsToRebuild.length > 0) {
    if (updateRuleInstanceStatus) {
      await riskRepository.updateRiskFactorStatus(
        riskFactor.id as string,
        'DEPLOYING'
      )
      logger.info(`Updated risk factor status to DEPLOYING: ${riskFactor.id}`)
    }
    await sendBatchJobCommand({
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: {
          type: 'RISK_FACTOR',
          riskFactorId: riskFactor.id as string,
        },
        aggregationVariables: aggVarsToRebuild,
      },
    })
    logger.info(
      `Created risk factor pre-aggregation job for risk factors: ${riskFactor.id}`
    )
  }
}
