import { getFiscalYearStart } from '@flagright/lib/utils/time'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  canAggregate,
  getAggregationGranularity,
} from '@/services/rules-engine/v8-engine/utils'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { RuleAggregationTimeWindow } from '@/@types/openapi-internal/RuleAggregationTimeWindow'
import dayjs, { Dayjs } from '@/utils/dayjs'
import { RuleAggregationVariableTimeWindow } from '@/@types/openapi-internal/RuleAggregationVariableTimeWindow'
import { ruleInstanceAggregationVariablesRebuild } from '@/services/rules-engine/utils'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const repo = new RuleInstanceRepository(tenantId, { dynamoDb })
  const ruleInstances = await repo.getAllRuleInstances()
  const targetV8RuleInstances = ruleInstances.filter(
    (ruleInstance) =>
      ruleInstance.id?.startsWith('RC-') &&
      ruleInstance.logicAggregationVariables &&
      ruleInstance.logicAggregationVariables.length
  )
  for (const ruleInstance of targetV8RuleInstances) {
    const logicAggregationVariables =
      ruleInstance.logicAggregationVariables ?? []
    const now = Date.now()
    let shouldRebuild = false
    for (const variable of logicAggregationVariables) {
      if (!canAggregate(variable.timeWindow)) {
        continue
      }
      const oldGranularity = oldGetAggregationGranularity(variable, tenantId)
      const newGranularity = getAggregationGranularity(
        variable.timeWindow,
        tenantId
      )

      let shouldRebuildVariable = false
      if (
        oldGranularity !== newGranularity &&
        ruleInstance.status !== 'INACTIVE'
      ) {
        console.info(
          `${ruleInstance.id} - ${variable.key}: ${oldGranularity} -> ${newGranularity}`
        )
        shouldRebuildVariable = true
      }
      const error = validateAggregationTimeWindow(variable.timeWindow)
      if (error) {
        // We need to ask customers to manually update the time window. After the time window
        // is updated, the rule will be rebuilt automatically.
        console.info(
          `${ruleInstance.id} - ${variable.key}: ${error} (requires manual update)`
        )
        shouldRebuildVariable = false
      }
      if (shouldRebuildVariable) {
        variable.version = now + 1
        shouldRebuild = true
      }
    }
    if (shouldRebuild) {
      await ruleInstanceAggregationVariablesRebuild(
        ruleInstance,
        now,
        tenantId,
        repo,
        { updateRuleInstanceStatus: true }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

function oldGetAggregationGranularity(
  aggregationVariable: RuleAggregationVariable,
  tenantId: string
) {
  const maxHoursToAggregateWithMinuteGranularity =
    // TODO: to be reverted in FR-5010
    tenantId === 'QYF2BOXRJI' // Capimoney
      ? 24
      : 3

  let start = aggregationVariable.timeWindow.start
  const end = aggregationVariable.timeWindow.end

  // TODO: to be reverted in FR-5010
  if (start.granularity === 'day' && start.units === 1) {
    start = { units: 24, granularity: 'hour' }
  }

  if (end.granularity === 'all_time') {
    return 'year'
  }
  if (start.rollingBasis || end.rollingBasis) {
    return 'hour'
  }

  if (end.granularity === 'now') {
    return start.granularity === 'hour' &&
      start.units <= maxHoursToAggregateWithMinuteGranularity
      ? 'minute'
      : start.granularity
  }
  return start.granularity === 'hour' &&
    start.units - (end.granularity === 'hour' ? end.units : 0) <=
      maxHoursToAggregateWithMinuteGranularity
    ? 'minute'
    : end.granularity
}

// Duplicated logic from phytoplankton
function getTimestamp(now: Dayjs, timeWindow: RuleAggregationTimeWindow) {
  if (timeWindow.granularity === 'fiscal_year') {
    if (!timeWindow.fiscalYear) {
      throw new Error('Missing fiscal year')
    }
    return getFiscalYearStart(now, timeWindow.fiscalYear).subtract(
      timeWindow.units,
      'year'
    )
  } else if (timeWindow.granularity === 'all_time') {
    return now.subtract(5, 'year')
  } else if (timeWindow.granularity === 'now') {
    return now
  }
  return now.subtract(timeWindow.units, timeWindow.granularity)
}
// Duplicated logic from phytoplankton
function validateAggregationTimeWindow(
  timeWindow: RuleAggregationVariableTimeWindow
) {
  const { start, end } = timeWindow
  const now = dayjs()
  const startTs = getTimestamp(now, start)
  const endTs = getTimestamp(now, end)

  if (startTs.valueOf() >= endTs.valueOf()) {
    return false
  }
  const granularities = new Set([start.granularity, end.granularity])
  if (
    (granularities.has('minute') || granularities.has('second')) &&
    endTs.diff(startTs, 'minute', true) > 60
  ) {
    return 'over 60 minutes'
  }
  if (granularities.has('hour') && endTs.diff(startTs, 'day', true) > 60) {
    return 'over 60 days'
  }

  if (
    granularities.has('day') &&
    start.rollingBasis &&
    endTs.diff(startTs, 'day', true) > 60
  ) {
    return 'over 60 days'
  }
  if (endTs.diff(startTs, 'year', true) > 5) {
    return 'over 5 years'
  }
  return null
}
