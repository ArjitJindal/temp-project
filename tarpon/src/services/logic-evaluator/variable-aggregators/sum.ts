import { sum } from 'lodash'
import { LogicVariableAggregator } from './types'

export const SUM: LogicVariableAggregator<number, number> = {
  returnValueType: 'number',
  init: () => 0,
  aggregate: (values) => sum(values),
  reduce: (aggregation, value) => aggregation + sum(value),
  merge: (aggregation1, aggregation2) => aggregation1 + aggregation2,
  compute: (aggregation) => aggregation,
}
