import compact from 'lodash/compact'
import fromPairs from 'lodash/fromPairs'
import isArray from 'lodash/isArray'
import keyBy from 'lodash/keyBy'
import sum from 'lodash/sum'
import sumBy from 'lodash/sumBy'
import { traverse } from '@flagright/lib/utils'
import {
  BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX,
  isDirectionLessVariable,
  RECEIVER_VARIABLE_KEY_SUFFIX,
  SENDER_VARIABLE_KEY_SUFFIX,
} from '../logic-evaluator/variables'
import {
  DispositionState,
  NumericOperatorPair,
  RuleVarsOptimzationData,
  StdDevSampleByKey,
  VarData,
} from './types'
import { ExecutedLogicVars } from '@/@types/openapi-internal/ExecutedLogicVars'

const ARITHMETIC_OPERATORS = ['>', '<', '<=', '>=']
const HIGHER_ORDER_OPERATORS = ['some', 'all', 'none']
export const FP_REASONS = ['False positive', 'Confirmed genuine']
export function sanitizeVarData(varData: VarData) {
  return fromPairs(
    Object.entries(varData).map(([key, values]) => [key, compact(values)])
  )
}

export function getNumericVarKeys(logic: any): string[] {
  const varkeys: string[] = []
  traverse(logic, (key, value, path) => {
    if (ARITHMETIC_OPERATORS.includes(key)) {
      // To do Handle Higher order functions (ex: some, none, all etc), handle numeric var inside a func
      // To do handle between using three params
      if (
        !isArray(value) ||
        value.length != 2 ||
        HIGHER_ORDER_OPERATORS.some((val) => path.includes(val))
      ) {
        return
      }
      const lhs = value[0]
      const rhs = value[1]
      if (typeof rhs === 'number' && typeof lhs === 'object' && 'var' in lhs) {
        varkeys.push(lhs.var)
      }
    }
  })
  return varkeys
}

export function getNumericVarKeyData(logic: any): NumericOperatorPair[] {
  const varkeysData: NumericOperatorPair[] = []
  traverse(logic, (key, value, path) => {
    if (ARITHMETIC_OPERATORS.includes(key)) {
      // To do Handle Higher order functions (ex: some, none, all etc), handle numeric var inside a func
      // To do handle between using three params
      if (
        !isArray(value) ||
        value.length != 2 ||
        HIGHER_ORDER_OPERATORS.some((val) => path.includes(val))
      ) {
        return
      }
      const lhs = value[0]
      const rhs = value[1]
      if (typeof rhs === 'number' && typeof lhs === 'object' && 'var' in lhs) {
        varkeysData.push({
          varKey: lhs.var,
          operator: key,
          value: rhs,
        })
      }
    }
  })
  return varkeysData
}

export function processTransactionVars(
  vars: ExecutedLogicVars[],
  varKeys: string[],
  varData: VarData
) {
  for (const data of vars) {
    const dt = data.value
    for (const key of varKeys) {
      if (isDirectionLessVariable(key)) {
        const baseKey = key.replace(BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX, '')
        const senderKey = `${baseKey}${SENDER_VARIABLE_KEY_SUFFIX}`
        const receiverKey = `${baseKey}${RECEIVER_VARIABLE_KEY_SUFFIX}`

        varData[key] = varData[key] || []
        varData[key].push(dt[senderKey], dt[receiverKey])
        continue
      }

      varData[key] = varData[key] || []
      varData[key].push(dt[key])
    }
  }
}

export function augmentVarData(varData: VarData): StdDevSampleByKey {
  const updatedData: StdDevSampleByKey = {}
  for (const [key, data] of Object.entries(varData)) {
    const sumValue = sum(data)
    const countValue = data.length
    const sumOfSquares = sumBy(data, (val) => val * val)
    updatedData[key] = {
      sum: sumValue,
      count: countValue,
      sumOfSquares: sumOfSquares,
    }
  }
  return updatedData
}

export function mergeData(
  existing: RuleVarsOptimzationData,
  newData: StdDevSampleByKey,
  state: DispositionState
): RuleVarsOptimzationData {
  const existingDataMap = keyBy(
    existing?.variablesOptimizationData ?? [],
    'varKey'
  )
  for (const [key, varData] of Object.entries(newData)) {
    if (existingDataMap[key]) {
      const oldData = existingDataMap[key][state] ?? {
        sum: 0,
        count: 0,
        sumOfSquares: 0,
      }
      existingDataMap[key][state] = {
        sum: oldData.sum + varData.sum,
        count: oldData.count + varData.count,
        sumOfSquares: oldData.sumOfSquares + varData.sumOfSquares,
      }
    } else {
      existingDataMap[key] = {
        varKey: key,
        [state]: {
          sum: varData.sum,
          count: varData.count,
          sumOfSquares: varData.sumOfSquares,
        },
      }
    }
  }
  return {
    ...existing,
    variablesOptimizationData: Object.values(existingDataMap),
    updatedAt: Date.now(),
  }
}
