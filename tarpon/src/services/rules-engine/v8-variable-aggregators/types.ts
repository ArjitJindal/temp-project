export type RuleVariableAggregator<P, R> = {
  init: () => R
  aggregate: (values: P[]) => Promise<R>
  reduce: (aggregation: R, value: P) => Promise<R>
  merge: (aggregation1: R, aggregation2: R) => R
}
