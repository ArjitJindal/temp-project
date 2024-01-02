import { RuleVariableAggregator } from './types'

export const COUNT: RuleVariableAggregator<unknown, number> = {
  init: () => 0,
  aggregate: async (values) => values.length,
  reduce: async (aggregation, _) => aggregation + 1,
  merge: (aggregation1, aggregation2) => aggregation1 + aggregation2,
}
