import cloneDeep from 'lodash/cloneDeep'
import mergeWith from 'lodash/mergeWith'
import { AVG } from './average'
import { COUNT } from './count'
import { SUM } from './sum'
import { LogicVariableAggregator } from './types'
import { UNIQUE_VALUES, UNIQUE_COUNT } from './unique'
import { MIN } from './min'
import { MAX } from './max'
import { STDEV } from './stdev'
import { CHANGE_COUNT } from './change-count'
import { LogicAggregationFunc } from '@/@types/openapi-internal/LogicAggregationFunc'

export function getLogicVariableAggregator(
  aggFunc: LogicAggregationFunc
): LogicVariableAggregator<any, any> {
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
    case 'MIN':
      return MIN
    case 'MAX':
      return MAX
    case 'STDEV':
      return STDEV
    case 'CHANGE_COUNT':
      return CHANGE_COUNT
  }
}

export function mergeValues(
  aggregator: LogicVariableAggregator<any, any>,
  value1: any,
  value2: any
) {
  return aggregator.merge(
    value1 ?? aggregator.init(),
    value2 ?? aggregator.init()
  )
}

export function mergeGroups(
  aggregator: LogicVariableAggregator<any, any>,
  groups1: { [key: string]: any } | undefined,
  groups2: { [key: string]: any } | undefined
) {
  return mergeWith(
    cloneDeep(groups1 ?? {}),
    cloneDeep(groups2 ?? {}),
    (groupValue1, groupValue2) => {
      return {
        value: aggregator.merge(
          groupValue1?.value ?? aggregator.init(),
          groupValue2?.value ?? aggregator.init()
        ),
        entities: [
          ...(groupValue1?.entities ?? []),
          ...(groupValue2?.entities ?? []),
        ],
      }
    }
  )
}
