import { RuleVariableAggregator } from './types'

export const MIN: RuleVariableAggregator<number, number> = {
  returnValueType: 'number',
  init: () => Number.MAX_SAFE_INTEGER,
  aggregate: (values) => Math.min(...values),
  reduce: (aggregation, value) => Math.min(aggregation, value),
  merge: (aggregation1, aggregation2) => Math.min(aggregation1, aggregation2),
  compute: (aggregation) => aggregation,
}
