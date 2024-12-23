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
import { canAggregateMinute } from '@flagright/lib/rules-engine'
import {
  VARIABLE_NAMESPACE_SEPARATOR,
  getDirectionalVariableKeys,
  isAggregationVariable,
  isDirectionLessVariable,
  isReceiverUserVariable,
  isSenderUserVariable,
} from '../variables'
import { JSON_LOGIC_BUILT_IN_OPERATORS, LOGIC_OPERATORS } from '../operators'
import dayjs from '@/utils/dayjs'
import { getTimeRangeByTimeWindows } from '@/services/rules-engine/utils/time-utils'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { LogicAggregationVariableTimeWindow } from '@/@types/openapi-internal/LogicAggregationVariableTimeWindow'
import { removeEmptyKeys } from '@/utils/object'

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
  JSON_LOGIC_BUILT_IN_OPERATORS.concat(LOGIC_OPERATORS.map((v) => v.key))
)
export function transformJsonLogic(
  rawJsonLogic: object,
  entityVariables: LogicEntityVariableInUse[] = []
) {
  const { entityVariableKeys } = getVariableKeysFromLogic(rawJsonLogic)
  for (const entityVariable of entityVariables) {
    if (isDirectionLessVariable(entityVariable.entityKey)) {
      entityVariables.push(
        ...getDirectionalVariableKeys(entityVariable.entityKey).map((v) => ({
          ...entityVariable,
          key: `${entityVariable.key}__${v.direction}`,
          entityKey: v.key,
        }))
      )
    }
  }

  const hasDirectionLessEntityVariables = entityVariableKeys.some((v) =>
    isDirectionLessVariable(
      entityVariables.find((e) => e.key === v)?.entityKey ?? v
    )
  )
  const hasAllOperator = getAllValuesByKey('all', rawJsonLogic)
  if (!hasDirectionLessEntityVariables && !hasAllOperator) {
    return rawJsonLogic
  }
  const updatedLogic = cloneDeep(rawJsonLogic)
  traverse(rawJsonLogic, (key, value, path) => {
    if (key === 'all') {
      // Retrieve the original "all" block
      const originalAll = get(rawJsonLogic, path)
      if (Array.isArray(originalAll) && originalAll.length > 0) {
        // Build the "and" block
        const hasItemsCheck = {
          'op:hasItems': [originalAll[0], true],
        }
        const wrappedLogic = {
          and: [hasItemsCheck, { all: originalAll }],
        }
        const parentPath = path.slice(0, -1) // Remove the last part of the path to get the parent
        set(updatedLogic, parentPath, wrappedLogic)
      }
    }
    if (key === 'var' && hasDirectionLessEntityVariables) {
      const isDirectionLessVar = isDirectionLessVariable(
        entityVariables.find((e) => e.key === value)?.entityKey ?? value
      )
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
        const directionalVariableKeys = isDirectionLessVariable(value)
          ? getDirectionalVariableKeys(value).map((v) => v.key)
          : [`${value}__SENDER`, `${value}__RECEIVER`]
        set(
          updatedLogic,
          [...path.slice(0, nearestOperatorIndex), 'or'],
          directionalVariableKeys.map((directionVarKey) =>
            replaceMagicKeyword(leafLogic, value, directionVarKey)
          )
        )
      }
    }
  })
  const { entityVariableKeys: newEntityVariableKeys } =
    getVariableKeysFromLogic(updatedLogic)
  const stillHasDirectionLessEntityVariables = newEntityVariableKeys.some(
    isDirectionLessVariable
  )
  // NOTE: Transform one more time if both LHS and RHS are direction-less variables
  return stillHasDirectionLessEntityVariables
    ? transformJsonLogic(updatedLogic, entityVariables)
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
  return removeEmptyKeys(
    omitBy(
      mapValues(newVarData, (value) => {
        if (isArray(value)) {
          return value.slice(0, maxVarDataLength)
        }
        return value
      }),
      (v) => isNil(v) || isNaN(v)
    )
  )
}

export function isUserVariable(varKey: string) {
  return ['USER', 'BUSINESS', 'CONSUMER_USER'].some((prefix) =>
    varKey.startsWith(prefix)
  )
}

export function userFiltersData(
  aggregationVariable: LogicAggregationVariable
): Set<string> {
  const userVariableKeys = getVariableKeysFromLogic(
    aggregationVariable.filtersLogic
  ).entityVariableKeys.filter(isUserVariable)
  const directions = new Set<string>()

  if (userVariableKeys.some(isSenderUserVariable)) {
    directions.add('sender')
  }
  if (userVariableKeys.some(isReceiverUserVariable)) {
    directions.add('receiver')
  }
  if (userVariableKeys.some(isDirectionLessVariable)) {
    directions.add('sender')
    directions.add('receiver')
  }
  return directions
}

const MAX_HOURS_TO_AGGREGATE_WITH_MINUTE_GRANULARITY = 3
export function getAggregationGranularity(
  timeWindow: LogicAggregationVariableTimeWindow,
  tenantId: string
) {
  const maxHoursToAggregateWithMinuteGranularity =
    // TODO: to be reverted in FR-5010
    tenantId === 'QYF2BOXRJI' // Capimoney
      ? 24
      : MAX_HOURS_TO_AGGREGATE_WITH_MINUTE_GRANULARITY

  const { start, end } = timeWindow
  const rollingBasis = start.rollingBasis || end.rollingBasis || false
  const granularities = new Set([start.granularity, end.granularity])
  granularities.delete('now')

  const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
    Date.now(),
    start,
    end
  )
  const diffHours = dayjs(beforeTimestamp).diff(dayjs(afterTimestamp), 'hour')
  if (diffHours <= maxHoursToAggregateWithMinuteGranularity) {
    return 'minute'
  }
  if (granularities.has('hour')) {
    if (granularities.has('year') || granularities.has('all_time')) {
      return 'day'
    }
    return 'hour'
  }
  if (granularities.has('day')) {
    if (granularities.size === 1) {
      return rollingBasis ? 'hour' : 'day'
    }
    return 'day'
  }
  if (rollingBasis) {
    return 'day'
  }
  if (granularities.has('week')) {
    return 'week'
  }
  if (granularities.has('month')) {
    return 'month'
  }
  if (granularities.has('year') || granularities.has('all_time')) {
    return 'year'
  }
  if (granularities.has('fiscal_year')) {
    return 'day'
  }
  return 'day'
}

export function canAggregate(timeWindow: LogicAggregationVariableTimeWindow) {
  const { units: startUnits, granularity: startGranularity } = timeWindow.start
  const { units: endUnits, granularity: endGranularity } = timeWindow.end
  if (startGranularity === 'second' || endGranularity === 'second') {
    return false
  }
  if (startGranularity === 'minute' || endGranularity === 'minute') {
    return canAggregateMinute(
      startGranularity,
      startUnits,
      endGranularity,
      endUnits
    )
  }
  return true
}
