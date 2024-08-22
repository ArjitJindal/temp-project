import { RuleVariableAggregator } from './types'

export const MAX: RuleVariableAggregator<number, number> = {
  returnValueType: 'number',
  init: () => Number.MIN_SAFE_INTEGER,
  aggregate: (values) => Math.max(...values),
  reduce: (aggregation, value) => Math.max(aggregation, value),
  merge: (aggregation1, aggregation2) => Math.max(aggregation1, aggregation2),
  compute: (aggregation) => aggregation,
}
