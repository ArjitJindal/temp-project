import {
  getAllValuesByKey,
  replaceMagicKeyword,
  traverse,
} from '@flagright/lib/utils'
import { cloneDeep, get, set, uniq, unset } from 'lodash'
import {
  VARIABLE_NAMESPACE_SEPARATOR,
  getDirectionalVariableKeys,
  isAggregationVariable,
  isDirectionLessVariable,
} from '../v8-variables'
import { JSON_LOGIC_BUILT_IN_OPERATORS, RULE_OPERATORS } from '../v8-operators'

export function getVariableKeysFromLogic(jsonLogic: object): {
  entityVariableKeys: string[]
  aggVariableKeys: string[]
} {
  const variableKeys = uniq(
    getAllValuesByKey<string>('var', jsonLogic).filter((v) =>
      // NOTE: We don't need to load the subfields of an array-type variable
      v.includes(VARIABLE_NAMESPACE_SEPARATOR)
    )
  )
  const entityVariableKeys = variableKeys.filter(
    (k) => !isAggregationVariable(k)
  )
  const aggVariableKeys = variableKeys.filter(isAggregationVariable)
  return { entityVariableKeys, aggVariableKeys }
}

// We transform the logic if the rule is using -
// - direction-less entity variables
// - aggregation group by field
const OPERATOR_KEYS = new Set(
  JSON_LOGIC_BUILT_IN_OPERATORS.concat(RULE_OPERATORS.map((v) => v.key))
)
export function transformJsonLogic(rawJsonLogic: object) {
  const { entityVariableKeys } = getVariableKeysFromLogic(rawJsonLogic)
  const hasDirectionLessEntityVariables = entityVariableKeys.some(
    isDirectionLessVariable
  )
  if (!hasDirectionLessEntityVariables) {
    return rawJsonLogic
  }
  const updatedLogic = cloneDeep(rawJsonLogic)
  traverse(rawJsonLogic, (key, value, path) => {
    if (key !== 'var') {
      return
    }
    const isDirectionLessVar = isDirectionLessVariable(value)
    if (isDirectionLessVar) {
      const nearestOperatorIndex =
        path.length -
        path
          .slice()
          .reverse()
          .findIndex((v) => OPERATOR_KEYS.has(v)) -
        1
      const leafLogic = cloneDeep(
        get(rawJsonLogic, path.slice(0, nearestOperatorIndex))
      )
      unset(updatedLogic, path.slice(0, nearestOperatorIndex + 1))
      /*
        Transforms
        {
          "==": [
            {
              "var": "entity:BOTH"
            },
            "value"
          ]
        }
        to
        {
          "or": [
            {
              "==": [
                {
                  "var": "entity:SENDER"
                },
                "value"
              ]
            },
            {
              "==": [
                {
                  "var": "entity:RECEIVER"
                },
                "value"
              ]
            }
          ]
        }
      */
      set(
        updatedLogic,
        [...path.slice(0, nearestOperatorIndex), 'or'],
        getDirectionalVariableKeys(value).map((directionVarKey) =>
          replaceMagicKeyword(leafLogic, value, directionVarKey)
        )
      )
    }
  })
  const { entityVariableKeys: newEntityVariableKeys } =
    getVariableKeysFromLogic(updatedLogic)
  const stillHasDirectionLessEntityVariables = newEntityVariableKeys.some(
    isDirectionLessVariable
  )
  // NOTE: Transform one more time if both LHS and RHS are direction-less variables
  return stillHasDirectionLessEntityVariables
    ? transformJsonLogic(updatedLogic)
    : updatedLogic
}
