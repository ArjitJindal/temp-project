import { LogicVariableAggregator } from './types'

export const COUNT: LogicVariableAggregator<unknown, number> = {
  returnValueType: 'number',
  init: () => 0,
  aggregate: (values) => values.length,
  reduce: (aggregation, _) => aggregation + 1,
  merge: (aggregation1, aggregation2) => aggregation1 + aggregation2,
  compute: (aggregation) => aggregation,
}
