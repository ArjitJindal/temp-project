import isEqual from 'lodash/isEqual'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import {
  AggregationRepository,
  getAggVarHash,
} from '@/services/logic-evaluator/engine/aggregation-repository'

export async function getLogicAggVarsWithUpdatedVersion(
  newEntity: RuleInstance | RiskFactor,
  entityId: string,
  oldEntity: RuleInstance | RiskFactor | null,
  aggregationRepository: AggregationRepository
): Promise<LogicAggregationVariable[] | undefined> {
  // Early return if no aggregation variables
  if (
    !newEntity.logicAggregationVariables ||
    newEntity.logicAggregationVariables.length === 0
  ) {
    return newEntity.logicAggregationVariables
  }

  const isBeingEnabled =
    (!oldEntity || oldEntity?.status === 'INACTIVE') &&
    newEntity.status === 'ACTIVE'

  const isBeingDisabled =
    oldEntity?.status === 'ACTIVE' && newEntity.status === 'INACTIVE'
  if (isBeingDisabled) {
    await aggregationRepository.updateLogicAggVars(
      undefined,
      entityId,
      newEntity
    )
    return newEntity.logicAggregationVariables
  }
  // Early return if aggregation variables are not changed
  if (
    newEntity.status === 'INACTIVE' ||
    (!isBeingEnabled &&
      isEqual(
        oldEntity?.logicAggregationVariables?.map((v) =>
          getAggVarHash(v, false)
        ),
        newEntity.logicAggregationVariables?.map((v) => getAggVarHash(v, false))
      ))
  ) {
    return newEntity.logicAggregationVariables
  }
  return await aggregationRepository.updateLogicAggVars(
    newEntity,
    entityId,
    (isBeingEnabled ? null : oldEntity) || // As if we are re-enabling the rule instance, we do not want to compare with it's own older version
      undefined
  )
}
