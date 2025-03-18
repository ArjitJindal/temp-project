import { NumericOperatorPair } from './types'
import { VarThresholdData } from '@/@types/openapi-internal/VarThresholdData'
import { RuleInstanceStats } from '@/@types/openapi-internal/RuleInstanceStats'
import { duration } from '@/utils/dayjs'

export function generateDemoThresholdData(
  data: NumericOperatorPair,
  currentStats: RuleInstanceStats
): VarThresholdData {
  const useGreater =
    data.operator === '>' || data.operator === '>=' ? true : false
  const changePercentage = (8 * Math.random() + 3) * 0.01
  const adjustmentFactor = useGreater
    ? 1 + changePercentage
    : 1 - changePercentage
  const newThreshold = Math.ceil(data.value * adjustmentFactor)
  const falsePositivesReduced = Math.ceil(changePercentage * 100 * 5)
  const transactionsHit = Math.ceil(
    (currentStats.transactionsHit ?? 0) * (1 - changePercentage)
  )
  const usersHit = Math.ceil(
    (currentStats.usersHit ?? 0) * (1 - changePercentage)
  )
  const timeReduced = Math.ceil(
    Math.max(
      currentStats.investigationTime ?? 0,
      duration(2, 'hours').asMilliseconds()
    ) *
      Math.max(
        Math.ceil((currentStats.transactionsHit ?? 0) - transactionsHit),
        1
      )
  )
  return {
    varKey: data.varKey,
    threshold: newThreshold,
    falsePositivesReduced: falsePositivesReduced,
    transactionsHit: transactionsHit,
    usersHit: usersHit,
    timeReduced: timeReduced,
  }
}
