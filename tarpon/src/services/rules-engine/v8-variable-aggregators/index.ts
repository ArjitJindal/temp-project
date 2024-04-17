import { cloneDeep, mergeWith } from 'lodash'
import { AVG } from './average'
import { COUNT } from './count'
import { SUM } from './sum'
import { RuleVariableAggregator } from './types'
import { UNIQUE_VALUES, UNIQUE_COUNT } from './unique'
import { RuleAggregationFunc } from '@/@types/openapi-internal/RuleAggregationFunc'

export function getRuleVariableAggregator(
  aggFunc: RuleAggregationFunc
): RuleVariableAggregator<any, any> {
  switch (aggFunc) {
    case 'COUNT':
      return COUNT
    case 'SUM':
      return SUM
    case 'AVG':
      return AVG
    case 'UNIQUE_COUNT':
      return UNIQUE_COUNT
    case 'UNIQUE_VALUES':
      return UNIQUE_VALUES
  }
}

export function mergeValues(
  aggregator: RuleVariableAggregator<any, any>,
  value1: any,
  value2: any
) {
  return aggregator.merge(
    value1 ?? aggregator.init(),
    value2 ?? aggregator.init()
  )
}

export function mergeGroups(
  aggregator: RuleVariableAggregator<any, any>,
  groups1: { [key: string]: any } | undefined,
  groups2: { [key: string]: any } | undefined
) {
  return mergeWith(
    cloneDeep(groups1 ?? {}),
    cloneDeep(groups2 ?? {}),
    (groupValue1, groupValue2) => {
      return aggregator.merge(
        groupValue1 ?? aggregator.init(),
        groupValue2 ?? aggregator.init()
      )
    }
  )
}
