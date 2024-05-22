import {
  getAllValuesByKey,
  replaceMagicKeyword,
  traverse,
} from '@flagright/lib/utils'
import {
  cloneDeep,
  get,
  isArray,
  isNil,
  isNaN,
  isPlainObject,
  mapValues,
  omitBy,
  set,
  uniq,
  unset,
} from 'lodash'
import { JSONPath } from 'jsonpath-plus'
import {
  VARIABLE_NAMESPACE_SEPARATOR,
  getDirectionalVariableKeys,
  isAggregationVariable,
  isDirectionLessVariable,
} from '../v8-variables'
import { JSON_LOGIC_BUILT_IN_OPERATORS, RULE_OPERATORS } from '../v8-operators'

export function isChildVariable(varKey: string) {
  return varKey.length > 0 && !varKey.includes(VARIABLE_NAMESPACE_SEPARATOR)
}

export function getVariableKeysFromLogic(jsonLogic: object): {
  entityVariableKeys: string[]
  aggVariableKeys: string[]
} {
  const variableKeys = uniq(
    getAllValuesByKey<string>('var', jsonLogic).filter(
      (v) =>
        // NOTE: We don't need to load the subfields of an array-type variable
        v && !isChildVariable(v)
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

// transform the raw var data to be the format that will be persisted
const DEFAULT_MAX_VAR_DATA_LENGTH = 50
export function transformJsonLogicVars(
  jsonLogic: object,
  varData: { [key: string]: any },
  options?: { maxVarDataLength?: number }
): { [key: string]: any } {
  const newVarData = { ...varData }
  const maxVarDataLength =
    options?.maxVarDataLength ?? DEFAULT_MAX_VAR_DATA_LENGTH
  const arrayTypeVarRootKeys = Object.entries(newVarData)
    .filter(
      ([key, value]) =>
        !isAggregationVariable(key) && isArray(value) && isPlainObject(value[0])
    )
    .map(([key]) => key)
  if (arrayTypeVarRootKeys.length) {
    arrayTypeVarRootKeys.forEach((key) => {
      newVarData[key] = {}
    })
    const arrayVarPaths: string[][] = []
    traverse(jsonLogic, (key, value, path) => {
      if (key === 'var' && arrayTypeVarRootKeys.includes(value)) {
        /*
        Given the following condition:
        {
            "some":
            [
                {
                    "var": "BUSINESS_USER:shareHolders__SENDER"
                },
                {
                    "some":
                    [
                        {
                            "var": "legalDocuments"
                        },
                        {
                            "==":
                            [
                                {
                                    "var": "documentType"
                                },
                                "abc"
                            ]
                        }
                    ]
                }
            ]
        }
        Generate the following varData:
        {
          BUSINESS_USER:shareHolders__SENDER: {
            legalDocuments: {
                documentType: [...]
            }
          }
        }
        */
        const conditionWithChildVars = get(
          jsonLogic,
          path.slice(0, path.length - 2)
        )[1]
        const currPath = [value]
        let prevLevel: number | null = null
        traverse(conditionWithChildVars, (cKey, cValue, cPath) => {
          if (cKey === 'var' && isChildVariable(cValue)) {
            const currLevel = cPath.filter((v) => OPERATOR_KEYS.has(v)).length
            if (!prevLevel || currLevel > prevLevel) {
              currPath.push(cValue)
            } else {
              arrayVarPaths.push([...currPath])
              const diffLevel = prevLevel - currLevel
              currPath.splice(-(diffLevel + 1))
              currPath.push(cValue)
            }
            prevLevel = currLevel
          }
        })
        arrayVarPaths.push(currPath)
      }
    })
    arrayVarPaths.forEach((arrayVarPath) => {
      const rootVar = arrayVarPath[0]
      const childArrayPaths = arrayVarPath.slice(1, -1)
      const childLeafPath = arrayVarPath.slice(-1)
      const childArrayQuery = childArrayPaths.map((v) => `.${v}[*]`).join('')
      const values = JSONPath({
        path: `$.[*]${childArrayQuery}.${childLeafPath}`,
        json: varData[rootVar],
      })
      newVarData[rootVar][arrayVarPath.slice(1).join('.')] = values.slice(
        0,
        maxVarDataLength
      )
    })
  }
  return omitBy(
    mapValues(newVarData, (value) => {
      if (isArray(value)) {
        return value.slice(0, maxVarDataLength)
      }
      return value
    }),
    (v) => isNil(v) || isNaN(v)
  )
}
