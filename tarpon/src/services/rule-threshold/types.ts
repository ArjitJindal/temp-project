import { StdDevSample } from '../logic-evaluator/variable-aggregators/stdev'

export type VarData = { [key: string]: number[] }

export type VarOptimizationData = {
  varKey: string
  FP?: StdDevSample
  TP?: StdDevSample
}

export type StdDevSampleByKey = { [key: string]: StdDevSample }

export type DispositionState = 'TP' | 'FP'

export type RuleVarsOptimzationData = {
  ruleInstanceId: string
  variablesOptimizationData: VarOptimizationData[]
  updatedAt: number
}

export type NumericOperatorPair = {
  varKey: string
  operator: string
  value: number
}
