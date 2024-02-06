import { sum } from 'lodash'
import { RuleVariableAggregator } from './types'

export const SUM: RuleVariableAggregator<number, number> = {
  returnValueType: 'number',
  init: () => 0,
  aggregate: (values) => sum(values),
  reduce: (aggregation, value) => aggregation + value,
  merge: (aggregation1, aggregation2) => aggregation1 + aggregation2,
  compute: (aggregation) => aggregation,
}
