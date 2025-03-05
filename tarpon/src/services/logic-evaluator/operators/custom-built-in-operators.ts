import { isNil } from 'lodash'
import { CustomOperator, LogicOperator } from './types'

export enum CustomBuiltInLogicOperatorKey {
  GREATER_THAN = '>',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL_TO = '<=',
  GREATER_THAN_OR_EQUAL_TO = '>=',
  IN = 'in',
  ALL = 'all',
  SOME = 'some',
  NONE = 'none',
  FILTER = 'filter',
  MAP = 'map',
  REDUCE = 'reduce',
}

function getCustomBuiltInComparisonLogicOperators(
  key: CustomBuiltInLogicOperatorKey
): LogicOperator {
  return {
    key,
    uiDefinition: {
      label: key,
      valueTypes: ['number'],
      valueSources: ['value', 'field', 'func'],
    },
    run: async (
      lhs: number | null | undefined,
      rhs: number | null | undefined,
      parameters?: number
    ) => {
      if (isNil(lhs) || isNil(rhs)) {
        return false
      }
      switch (key) {
        case '>':
          return lhs > rhs
        case '<':
          return lhs < rhs
        case '<=':
          // <= is used for 'Between' operator
          if (parameters != null && Number.isFinite(parameters)) {
            return lhs <= rhs && rhs <= parameters
          }
          return lhs <= rhs
        case '>=':
          return lhs >= rhs
        default:
          return false
      }
    },
  } as LogicOperator
}

export const CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR = {
  key: CustomBuiltInLogicOperatorKey.IN,
  uiDefinition: {
    label: 'Any in',
    valueTypes: ['multiselect', 'text'],
  },
  run: async (
    lhs: string | null | undefined,
    rhs: string[] | number[] | null | undefined
  ) => {
    if (isNil(lhs) || isNil(rhs)) {
      return false
    }

    const rhsArray = (rhs ?? []).map((item: string | number) => {
      if (typeof item === 'number') {
        return item.toString()
      }
      return item
    })

    return rhsArray.some((item) => item === lhs)
  },
}

export const CUSTOM_IN_BUILT_ARRAY_ALL_OPERATOR: LogicOperator = {
  key: CustomBuiltInLogicOperatorKey.ALL,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'All',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }

    const arrEvaluated = await engine.run(lhs, executionContext)

    if (!Array.isArray(arrEvaluated)) {
      return false
    }
    for (const x of arrEvaluated) {
      const subContext =
        typeof x === 'object'
          ? {
              ...executionContext,
              ...x,
            }
          : x
      const runResult = await engine.run(rhs, subContext)
      if (!runResult) {
        return false
      }
    }
    return true
  },
}

export const CUSTOM_IN_BUILT_ARRAY_SOME_OPERATOR: LogicOperator = {
  key: CustomBuiltInLogicOperatorKey.SOME,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'Some',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }

    const arrEvaluated = await engine.run(lhs, executionContext)

    if (!Array.isArray(arrEvaluated)) {
      return false
    }

    for (const x of arrEvaluated) {
      const subContext =
        typeof x === 'object'
          ? {
              ...executionContext,
              ...x,
            }
          : x
      const runResult = await engine.run(rhs, subContext)
      if (runResult === true) {
        return true
      }
    }
    return false
  },
}

export const CUSTOM_IN_BUILT_ARRAY_NONE_OPERATOR: LogicOperator = {
  key: CustomBuiltInLogicOperatorKey.NONE,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'None',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }
    const arrEvaluated = await engine.run(lhs, executionContext)

    if (!Array.isArray(arrEvaluated)) {
      return true
    }

    for (const x of arrEvaluated) {
      const subContext =
        typeof x === 'object'
          ? {
              ...executionContext,
              ...x,
            }
          : x
      const runResult = await engine.run(rhs, subContext)
      if (runResult === true) {
        return false
      }
    }
    return true
  },
}

export const CUSTOM_IN_BUILT_ARRAY_FILTER_OPERATOR: CustomOperator = {
  key: CustomBuiltInLogicOperatorKey.FILTER,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'Filter',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }
    const arrEvaluated = await engine.run(lhs, executionContext)
    if (!Array.isArray(arrEvaluated)) {
      return []
    }

    const checks = await Promise.all(
      arrEvaluated.map(async (x) => {
        const subContext =
          typeof x === 'object'
            ? {
                ...executionContext,
                ...x,
              }
            : x
        return !!(await engine.run(rhs, subContext))
      })
    )

    return arrEvaluated.filter((_, i) => checks[i])
  },
}

export const CUSTOM_IN_BUILT_ARRAY_MAP_OPERATOR: CustomOperator = {
  key: CustomBuiltInLogicOperatorKey.MAP,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'Map',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }
    const arrEvaluated = await engine.run(lhs, executionContext)
    if (!Array.isArray(arrEvaluated)) {
      return []
    }

    return await Promise.all(
      arrEvaluated.map(async (x) => {
        const subContext =
          typeof x === 'object'
            ? {
                ...executionContext,
                ...x,
              }
            : x
        return await engine.run(rhs, subContext)
      })
    )
  },
}

export const CUSTOM_IN_BUILT_ARRAY_REDUCE_OPERATOR: CustomOperator = {
  key: CustomBuiltInLogicOperatorKey.REDUCE,
  traverse: false,
  deterministic: false,
  uiDefinition: {
    label: 'Reduce',
  },
  run: async (
    lhs: number | null | undefined,
    rhs: number | null | undefined,
    parameters: number | undefined,
    context,
    internalContext
  ) => {
    const { engine, executionContext = {} } = internalContext ?? {}
    if (engine == null) {
      throw new Error(
        `Engine should be defined for running custom operation implementation`
      )
    }
    const arrEvaluated = await engine.run(lhs, executionContext)
    if (!Array.isArray(arrEvaluated)) {
      return parameters
    }

    let result = typeof parameters === 'number' ? parameters : 0

    for (const x of arrEvaluated) {
      const subContext =
        typeof x === 'object'
          ? {
              ...executionContext,
              ...x,
              current: x,
              accumulator: result,
            }
          : {
              ...executionContext,
              current: x,
              accumulator: result,
            }

      result = await engine.run(rhs, subContext)
    }
    return result
  },
}

export const CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.GREATER_THAN
  )
export const CUSTOM_IN_BUILT_LESS_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.LESS_THAN
  )
export const CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.LESS_THAN_OR_EQUAL_TO
  )
export const CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.GREATER_THAN_OR_EQUAL_TO
  )

const _CUSTOM_BUILT_IN_LOGIC_OPERATORS = [
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_ALL_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_SOME_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_NONE_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_FILTER_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_MAP_OPERATOR,
  CUSTOM_IN_BUILT_ARRAY_REDUCE_OPERATOR,
]
export const CUSTOM_BUILT_IN_LOGIC_OPERATORS: LogicOperator[] =
  _CUSTOM_BUILT_IN_LOGIC_OPERATORS.map((operator) => ({
    ...operator,
    uiDefinition: {
      ...operator.uiDefinition,
      jsonLogic: operator.key,
    },
  }))
