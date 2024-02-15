import { pickBy } from 'lodash'
import { LegacyFilters, TransactionHistoricalFilters } from '../filters'
import { TransactionsVelocityRuleParameters } from '../transaction-rules/transactions-velocity'
import { MultipleSendersWithinTimePeriodRuleParameters } from '../transaction-rules/multiple-senders-within-time-period-base'
import { FirstActivityAfterLongTimeRuleParameters } from '../transaction-rules/first-activity-after-time-period'
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

  'R-10': (parameters: MultipleSendersWithinTimePeriodRuleParameters) => {
    const logicAggregationVariables: RuleAggregationVariable[] = []
    const alertCreationDirection: AlertCreationDirection = 'DESTINATION'

    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: 'USER_TRANSACTIONS',
      direction: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:paymentDetailsIdentifier__SENDER',
      aggregationFunc: 'UNIQUE_COUNT',
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'day' },
      },
      filtersLogic: {
        '!': { var: 'TRANSACTION:originUserId' },
      },
    })
    return {
      logic: {
        '>': [{ var: 'agg:receiving' }, parameters.sendersCount],
      },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },

  'R-5': (parameters: FirstActivityAfterLongTimeRuleParameters, filters) => {
    const { dormancyPeriodDays, checkDirection = 'all' } = parameters
    const aggregationVariable: RuleAggregationVariable[] =
      migrateCheckDirectionParameters(
        'COUNT',
        {
          timeWindow: {
            granularity: 'day',
            units: dormancyPeriodDays,
            rollingBasis: true,
          },
          checkSender: checkDirection,
          checkReceiver: 'none',
        },
        filters
      ).logicAggregationVariables

    const conditions: any[] = []

    const v = aggregationVariable[0]
    conditions.push({
      '==': [{ var: v.key }, 1],
    })

    const orConditions: any[] = []

    orConditions.push({
      '!=': [{ var: 'USER:sendingTransactionsCount__SENDER' }, 0],
    })

    if (checkDirection === 'all') {
      orConditions.push({
        '!=': [{ var: 'USER:receivingTransactionsCount__SENDER' }, 0],
      })
    }

    conditions.push({
      or: orConditions,
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: aggregationVariable,
      alertCreationDirection: 'ORIGIN',
    }
  },
}
