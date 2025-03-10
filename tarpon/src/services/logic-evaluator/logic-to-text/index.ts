import { lowerCase, startCase } from 'lodash'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import pluralize from 'pluralize'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { LogicAggregationTimeWindow } from '@/@types/openapi-internal/LogicAggregationTimeWindow'
import {
  AllJsonLogicOperators,
  StaticallyDescriptionGenerator,
} from '@/@types/rule/logic-to-text'

const staticOperators: Record<StaticallyDescriptionGenerator, string> = {
  '==': 'is equal to',
  '!=': 'is not equal to',
  '>': 'is greater than',
  '>=': 'is greater than or equal to',
  '<': 'is less than',
  '<=': 'is less than or equal to',
  '!==': 'is not equal to',
  '!': 'is not',
  '!!': 'is not not',
  '/': 'is divisible by',
  '%': 'remainder of',
  '*': 'multiplied by',
  '+': 'plus',
  '-': 'minus',
  '===': 'is equal to',
  map: 'map',
  reduce: 'reduce',
  filter: 'filter',
  all: 'all',
  none: 'none',
  some: 'some',
  in: 'is in',
  cat: 'concatenate',
  substr: 'substring',
  log: 'log',
  missing: 'missing',
  missing_some: 'missing some',
  if: 'if',
  max: 'maximum',
  min: 'minimum',
  'op:!between_time': 'is not between time',
  'op:between_time': 'is between time',
  'op:!contains': 'is not contains',
  'op:contains': 'is contains',
  'op:!inlist': 'is not in list',
  'op:inlist': 'is in list',
  'op:!regexmatch': 'is not regex match',
  'op:regexmatch': 'is regex match',
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  'op:startswith': 'is start with',
  'op:!similarto': 'is not similar to',
  'op:similarto': 'is similar to',
  number_to_string: 'number to string',
  string_to_number: 'string to number',
  truncate_decimal: 'truncate decimal',
  'op:!similartowords': 'is not similar to words',
  'op:similartowords': 'is similar to words',
  number_of_items: 'number of items',
  number_of_objects: 'number of objects',
  local_time_in_hour: 'local time in hour',
  timestamp_diff_seconds: 'timestamp diff seconds',
  merge: 'merge',
  'op:endswith': 'is end with',
  'op:time_difference_greater_than': 'time difference greater than',
  'op:time_difference_lesser_than': 'time difference lesser than',
}

export class V8LogicToText {
  constructor(
    private readonly logic: any,
    private readonly logicEntityVariables: LogicEntityVariableInUse[],
    private readonly logicAggregatorVariables: LogicAggregationVariable[]
  ) {
    this.logic = logic
    this.logicEntityVariables = logicEntityVariables
    this.logicAggregatorVariables = logicAggregatorVariables
  }

  private varLabelWithoutNamespace(label: string): string {
    return label.replace(/^.+\s*\/\s*/, '')
  }

  private formatTimeWindow(timeWindow: LogicAggregationTimeWindow): string {
    if (timeWindow.granularity === 'all_time') {
      return 'the beginning of time'
    }
    if (timeWindow.granularity === 'now' || timeWindow.units === 0) {
      return 'now'
    }
    return `${timeWindow.units} ${pluralize(
      lowerCase(humanizeAuto(timeWindow.granularity)),
      timeWindow.units
    )} ago`
  }

  private varLabelWithoutDirection(label: string): string {
    return label.replace(/^(origin|destination)\s*/, '')
  }

  private internalAggregationLogicToText(
    variableFormValues: LogicAggregationVariable
  ): string {
    const {
      type,
      userDirection,
      transactionDirection,
      aggregationFieldKey,
      aggregationGroupByFieldKey,
      aggregationFunc,
      timeWindow,
      filtersLogic,
      lastNEntities,
    } = variableFormValues
    const entityVariables = this.logicEntityVariables
    if (
      !type ||
      !userDirection ||
      !transactionDirection ||
      !aggregationFieldKey ||
      !aggregationFunc ||
      !timeWindow
    ) {
      return 'N/A'
    }

    const aggFuncLabel = humanizeAuto(aggregationFunc)
    const aggregationFieldVariable = entityVariables.find(
      (v) => v.key === aggregationFieldKey
    )
    const aggregationGroupByFieldVariable = aggregationGroupByFieldKey
      ? entityVariables.find((v) => v.key === aggregationGroupByFieldKey)
      : undefined

    let aggFieldLabel =
      aggregationFunc === 'COUNT'
        ? undefined
        : pluralize(lowerCase(aggregationFieldVariable?.entityKey))
    if (aggFieldLabel && transactionDirection === 'SENDING_RECEIVING') {
      aggFieldLabel = this.varLabelWithoutDirection(aggFieldLabel)
    }

    const aggGroupByFieldLabel =
      aggregationGroupByFieldVariable &&
      lowerCase(
        this.varLabelWithoutNamespace(aggregationGroupByFieldVariable.entityKey)
      )

    const txDirectionLabel =
      transactionDirection === 'SENDING'
        ? 'sending'
        : transactionDirection === 'RECEIVING'
        ? 'receiving'
        : 'sending or receiving'

    const userDirectionLabel =
      userDirection === 'SENDER'
        ? 'sender '
        : userDirection === 'RECEIVER'
        ? 'receiver '
        : 'sender or receiver '

    const userLabel = type === 'USER_TRANSACTIONS' ? 'user' : 'payment ID'

    let summary = `${aggFuncLabel} of `
    if (aggFieldLabel) {
      summary += `${aggFieldLabel} in `
    }
    summary += `${txDirectionLabel} transactions `
    if (aggGroupByFieldLabel) {
      summary += `(with the same ${aggGroupByFieldLabel}) `
    }
    summary += `by a ${userDirectionLabel}${userLabel} `

    if (lastNEntities) {
      summary += `for last ${lastNEntities} transactions `
    } else {
      summary += `from ${this.formatTimeWindow(
        timeWindow.end
      )} to ${this.formatTimeWindow(timeWindow.start)} `
    }

    if (filtersLogic) {
      summary += `(with filters (${this.toText(filtersLogic)})`
    }

    return summary.trim()
  }

  private internalIsArray(logic: any): boolean {
    return (
      Array.isArray(logic) &&
      !!logic.length &&
      ['string', 'number', 'boolean'].includes(typeof logic[0])
    )
  }

  private entityVariableToText(
    entityVariable: LogicEntityVariableInUse
  ): string {
    const entityKeys = entityVariable.entityKey.split(':')
    const entityType = startCase(entityKeys[0].toLowerCase())
    const entityKey = entityKeys[1].split('-').map(lowerCase).join(' ')
    if (entityVariable.filtersLogic) {
      return `${entityType}:${entityKey} (with filters (${this.toText(
        entityVariable.filtersLogic
      )}))`
    }
    return `${entityType} ${entityKey}`
  }

  private toText(logic: any): string {
    if (this.internalIsArray(logic)) {
      return (logic as string[] | number[] | boolean[])
        .map((item) => item)
        .join(', ')
    }

    if (typeof logic !== 'object' || logic === null) {
      return String(logic)
    }

    const logicKeys = Object.keys(logic) as AllJsonLogicOperators[]

    for (const key of logicKeys) {
      if (key === 'and' || key === 'or') {
        return (
          '(' +
          logic[key].map((item: any) => this.toText(item)).join(` ${key} `) +
          ')'
        )
      }

      if (key in staticOperators) {
        return `${this.toText(logic[key][0])} ${
          staticOperators[key]
        } ${this.toText(logic[key][1])}`
      }

      if (key === 'var') {
        if (logic[key].startsWith('entity:')) {
          const logicEntityVariable = this.logicEntityVariables.find(
            (v) => v.key === logic[key]
          )
          if (!logicEntityVariable) {
            return logic[key]
          }

          return this.entityVariableToText(logicEntityVariable)
        }

        if (logic[key].startsWith('agg:')) {
          const logicAggregatorVariable = this.logicAggregatorVariables.find(
            (v) => v.key === logic[key]
          )
          if (!logicAggregatorVariable) {
            return logic[key]
          }

          return (
            logicAggregatorVariable.name ??
            this.internalAggregationLogicToText(logicAggregatorVariable)
          )
        }

        return logic[key]
      }
    }

    return ''
  }

  public ruleLogicToText(prefix?: string) {
    return `${prefix ?? ''}${this.toText(this.logic)}`
  }
}
