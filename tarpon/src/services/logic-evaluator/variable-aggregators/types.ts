export type LogicVariableAggregator<
  Value,
  AggregationData,
  ComputeValue = AggregationData
> = {
  returnValueType: 'number' | 'string' | 'boolean' | 'array'
  init: () => AggregationData
  aggregate: (values: Value[]) => AggregationData
  reduce: (aggregation: AggregationData, value: Value[]) => AggregationData
  merge: (
    aggregation1: AggregationData,
    aggregation2: AggregationData
  ) => AggregationData
  compute: (aggregation: AggregationData) => ComputeValue
}
