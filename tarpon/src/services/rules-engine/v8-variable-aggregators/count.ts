import { RuleVariableAggregator } from './types'

export const COUNT: RuleVariableAggregator<unknown, number> = {
  returnValueType: 'number',
  init: () => 0,
  aggregate: (values) => values.length,
  reduce: (aggregation, _) => aggregation + 1,
  merge: (aggregation1, aggregation2) => aggregation1 + aggregation2,
  compute: (aggregation) => aggregation,
}
