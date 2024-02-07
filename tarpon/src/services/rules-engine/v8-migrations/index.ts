import { pickBy } from 'lodash'
import { LegacyFilters, TransactionHistoricalFilters } from '../filters'
import { TransactionsVelocityRuleParameters } from '../transaction-rules/transactions-velocity'
import { getFiltersConditions, migrateCheckDirectionParameters } from './utils'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

export function getMigratedV8Config(
  ruleId: string,
  parameters: any = {},
  filters: LegacyFilters = {}
): {
  logic: object
  filtersLogic: object | undefined
  logicAggregationVariables: RuleAggregationVariable[]
  alertCreationDirection?: AlertCreationDirection
} | null {
  const migrationFunc = V8_CONVERSION[ruleId]
  if (!migrationFunc) {
    return null
  }
  const historicalFilters = pickBy(filters, (_value, key) =>
    key.endsWith('Historical')
  ) as TransactionHistoricalFilters
  const result = migrationFunc(parameters, historicalFilters)
  const filterConditions = getFiltersConditions(filters)

  return {
    ...result,
    filtersLogic:
      filterConditions.length > 0 ? { and: filterConditions } : undefined,
  }
}

const V8_CONVERSION: {
  [ruleId: string]: (
    parameters: any,
    filters: TransactionHistoricalFilters
  ) => {
    logic: object
    logicAggregationVariables: RuleAggregationVariable[]
    alertCreationDirection?: AlertCreationDirection
  }
} = {
  'R-30': (parameters: TransactionsVelocityRuleParameters, filters) => {
    const { logicAggregationVariables, alertCreationDirection } =
      migrateCheckDirectionParameters('COUNT', parameters, filters)
    const conditions: any[] = []
    if (logicAggregationVariables.length === 1) {
      const v = logicAggregationVariables[0]
      conditions.push({
        '>': [{ var: v.key }, parameters.transactionsLimit],
      })
    } else if (logicAggregationVariables.length > 1) {
      conditions.push({
        or: logicAggregationVariables.map((v) => ({
          '>': [{ var: v.key }, parameters.transactionsLimit],
        })),
      })
    }
    if (parameters.onlyCheckKnownUsers) {
      conditions.push({
        and: [
          {
            '!!': {
              var: 'TRANSACTION:originUserId',
            },
          },
          {
            '!!': {
              var: 'TRANSACTION:destinationUserId',
            },
          },
        ],
      })
    }
    if (conditions.length === 0) {
      conditions.push(false)
    }
    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },
}
