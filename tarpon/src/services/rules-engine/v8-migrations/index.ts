import { isEmpty, pickBy, zip } from 'lodash'
import { expandCountryGroup } from '@flagright/lib/constants'
import { LegacyFilters, TransactionHistoricalFilters } from '../filters'
import { TransactionsVelocityRuleParameters } from '../transaction-rules/transactions-velocity'
import { MultipleSendersWithinTimePeriodRuleParameters } from '../transaction-rules/multiple-senders-within-time-period-base'
import { FirstActivityAfterLongTimeRuleParameters } from '../transaction-rules/first-activity-after-time-period'
import { TooManyTransactionsToHighRiskCountryRuleParameters } from '../transaction-rules/too-many-transactions-to-high-risk-country'
import { MerchantReceiverNameRuleParameters } from '../transaction-rules/merchant-receiver-name'
import { BlacklistCardIssuedCountryRuleParameters } from '../transaction-rules/blacklist-card-issued-country'
import { HighRiskCurrencyRuleParameters } from '../transaction-rules/high-risk-currency'
import { TransactionAmountRuleParameters } from '../transaction-rules/transaction-amount'
import { TransactionMatchesPatternRuleParameters } from '../transaction-rules/transaction-amount-pattern'
import { TransactionsVolumeRuleParameters } from '../transaction-rules/transactions-volume'
import { TransactionReferenceKeywordRuleParameters } from '../transaction-rules/transaction-reference-keyword'
import { TransactionsAverageAmountExceededParameters } from '../transaction-rules/transactions-average-amount-exceeded'
import { TransactionsAverageNumberExceededParameters } from '../transaction-rules/transactions-average-number-exceeded'
import { TransactionVolumeExceedsTwoPeriodsRuleParameters } from '../transaction-rules/total-transactions-volume-exceeds'
import {
  getFiltersConditions,
  getHistoricalFilterConditions,
  migrateCheckDirectionParameters,
} from './utils'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { TransactionsExceedPastPeriodRuleParameters } from '@/services/rules-engine/transaction-rules/transactions-exceed-past-period'
import { TransactionNewCountryRuleParameters } from '@/services/rules-engine/transaction-rules/transaction-new-country'
import { TransactionNewCurrencyRuleParameters } from '@/services/rules-engine/transaction-rules/transaction-new-currency'
import { IpAddressUnexpectedLocationRuleParameters } from '@/services/rules-engine/transaction-rules/ip-address-unexpected-location'

export type RuleMigrationConfig = {
  logic: object
  logicAggregationVariables: LogicAggregationVariable[]
  alertCreationDirection?: AlertCreationDirection
  baseCurrency?: CurrencyCode
}

export function getMigratedV8Config(
  ruleId: string,
  parameters: any = {},
  filters: LegacyFilters = {}
): RuleMigrationConfig | null {
  const migrationFunc = V8_CONVERSION[ruleId]

  if (!migrationFunc && Object.keys(filters).length === 0) {
    return null
  }

  const historicalFilters = pickBy(filters, (_value, key) =>
    key.includes('Historical')
  ) as TransactionHistoricalFilters
  let result
  if (migrationFunc) {
    result = migrationFunc(parameters)
  }
  const {
    filterConditions,
    baseCurrency: filtersCurrency,
    alertCreationDirection: filtersAlertCreationDirection,
  } = getFiltersConditions(filters)

  if (result?.logic === undefined) {
    return {
      logic: {
        and: filterConditions.length === 0 ? [true] : filterConditions,
      },
      logicAggregationVariables: [],
      alertCreationDirection: filtersAlertCreationDirection,
      baseCurrency: filtersCurrency as CurrencyCode,
    }
  } else if (filterConditions.length > 0) {
    result.logic = {
      and: [{ and: filterConditions }, result.logic],
    }
  }
  if (result?.logicAggregationVariables?.length > 0) {
    result.logicAggregationVariables = result.logicAggregationVariables.map(
      (v) => {
        if (v.timeWindow.end.units === 0) {
          return {
            ...v,
            timeWindow: {
              ...v.timeWindow,
              end: { units: 0, granularity: 'now' },
            },
          }
        }
        return v
      }
    )
  }
  if (!result?.baseCurrency && filtersCurrency) {
    result = { ...result, baseCurrency: filtersCurrency as CurrencyCode }
  }
  if (!result?.alertCreationDirection && filtersAlertCreationDirection) {
    result = {
      ...result,
      alertCreationDirection: filtersAlertCreationDirection,
    }
  }
  if (result?.logicAggregationVariables) {
    const {
      conditions: historicalFilterConditions,
      baseCurrency: filtersCurrency,
    } = getHistoricalFilterConditions(historicalFilters)
    if (historicalFilterConditions.length > 0) {
      result.logicAggregationVariables = result.logicAggregationVariables.map(
        (v) => {
          return {
            ...v,
            baseCurrency: v.baseCurrency ?? (filtersCurrency as CurrencyCode),
            filtersLogic: {
              and: [
                v.filtersLogic ?? true,
                { and: historicalFilterConditions },
              ],
            },
          }
        }
      )
    }
  }

  return result
}

const DEVIATION_RULE_MIGRATION = (
  type: 'COUNT' | 'AMOUNT',
  aggFunc: 'AVG' | 'SUM' | 'COUNT',
  daily: boolean,
  parameters:
    | TransactionsAverageAmountExceededParameters &
        TransactionsAverageNumberExceededParameters &
        TransactionsAverageAmountExceededParameters &
        TransactionVolumeExceedsTwoPeriodsRuleParameters
) => {
  const { multiplierThreshold, excludePeriod1 } = parameters
  const baseCurrency =
    type === 'AMOUNT'
      ? (multiplierThreshold.currency as CurrencyCode)
      : undefined
  const {
    logicAggregationVariables: period1LogicAggregationVariablesAvgAmount,
    alertCreationDirection,
  } = migrateCheckDirectionParameters({
    type,
    parameters: {
      timeWindow: parameters.period1,
      checkSender: parameters.checkSender,
      checkReceiver: parameters.checkReceiver,
    },
    aggFunc,
    baseCurrency,
  })
  const {
    logicAggregationVariables: period2LogicAggregationVariablesAvgAmount,
  } = migrateCheckDirectionParameters({
    type,
    parameters: {
      timeWindow: parameters.period2,
      checkSender: parameters.checkSender,
      checkReceiver: parameters.checkReceiver,
    },
    aggFunc,
    baseCurrency,
  })
  let period1LogicAggregationVariablesCount: LogicAggregationVariable[] = []
  let period2LogicAggregationVariablesCount: LogicAggregationVariable[] = []
  if (!isEmpty(parameters.transactionsNumberThreshold)) {
    const { logicAggregationVariables } = migrateCheckDirectionParameters({
      type: 'COUNT',
      parameters: {
        timeWindow: parameters.period1,
        checkSender: parameters.checkSender,
        checkReceiver: parameters.checkReceiver,
      },
    })
    period1LogicAggregationVariablesCount = logicAggregationVariables
  }
  if (!isEmpty(parameters.transactionsNumberThreshold2)) {
    const { logicAggregationVariables } = migrateCheckDirectionParameters({
      type: 'COUNT',
      parameters: {
        timeWindow: parameters.period2,
        checkSender: parameters.checkSender,
        checkReceiver: parameters.checkReceiver,
      },
    })
    period2LogicAggregationVariablesCount = logicAggregationVariables
  }

  const period1TimeWindow =
    period1LogicAggregationVariablesAvgAmount[0].timeWindow
  if (excludePeriod1) {
    period2LogicAggregationVariablesAvgAmount.forEach((v) => {
      v.timeWindow.end = period1TimeWindow.start
    })
    period2LogicAggregationVariablesCount.forEach((v) => {
      v.timeWindow.end = period1TimeWindow.start
    })
  }

  const conditions: any[] = []
  for (const tuple of zip(
    period1LogicAggregationVariablesAvgAmount,
    period2LogicAggregationVariablesAvgAmount,
    period1LogicAggregationVariablesCount,
    period2LogicAggregationVariablesCount
  )) {
    const period1AvgAmountVar = tuple[0] as LogicAggregationVariable
    const period2AvgAmountVar = tuple[1] as LogicAggregationVariable
    const period1CountVar = tuple[2] as LogicAggregationVariable
    const period2CountVar = tuple[3] as LogicAggregationVariable

    const period1Var = daily
      ? {
          '/': [{ var: period1AvgAmountVar.key }, parameters.period1.units],
        }
      : { var: period1AvgAmountVar.key }
    const period2Var = daily
      ? {
          '/': [
            { var: period2AvgAmountVar.key },
            parameters.excludePeriod1
              ? parameters.period2.units - parameters.period1.units
              : parameters.period2.units,
          ],
        }
      : { var: period2AvgAmountVar.key }

    const subconditions: any[] = [
      {
        '>': [period2Var, 0],
      },
      {
        '>': [
          {
            '/': [period1Var, period2Var],
          },
          (type === 'AMOUNT'
            ? multiplierThreshold.value
            : multiplierThreshold) / 100,
        ],
      },
    ]

    if (period1CountVar) {
      subconditions.push({
        '<=': [
          parameters.transactionsNumberThreshold?.min ?? 0,
          {
            var: period1CountVar.key,
          },
          parameters.transactionsNumberThreshold?.max ??
            Number.MAX_SAFE_INTEGER,
        ],
      })
    }
    if (period2CountVar) {
      subconditions.push({
        '<=': [
          parameters.transactionsNumberThreshold2?.min ?? 0,
          {
            var: period2CountVar.key,
          },
          parameters.transactionsNumberThreshold2?.max ??
            Number.MAX_SAFE_INTEGER,
        ],
      })
    }
    if (!isEmpty(parameters.valueThresholdPeriod1)) {
      subconditions.push({
        '<=': [
          parameters.valueThresholdPeriod1?.min ?? 0,
          period1Var,
          parameters.valueThresholdPeriod1?.max ?? Number.MAX_SAFE_INTEGER,
        ],
      })
    }
    conditions.push({ and: subconditions })
  }

  return {
    logic: { or: conditions },
    logicAggregationVariables: [
      ...period1LogicAggregationVariablesAvgAmount,
      ...period2LogicAggregationVariablesAvgAmount,
      ...period1LogicAggregationVariablesCount,
      ...period2LogicAggregationVariablesCount,
    ],
    alertCreationDirection,
  }
}

const V8_CONVERSION: Readonly<
  Record<string, (parameters: any) => RuleMigrationConfig>
> = {
  'R-30': (parameters: TransactionsVelocityRuleParameters) => {
    const { logicAggregationVariables, alertCreationDirection } =
      migrateCheckDirectionParameters({ type: 'COUNT', parameters })
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
    const logicAggregationVariables: LogicAggregationVariable[] = []
    const alertCreationDirection: AlertCreationDirection = 'DESTINATION'

    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:originPaymentDetailsIdentifier',
      aggregationFunc: 'UNIQUE_COUNT',
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      filtersLogic: {
        '!': { var: 'TRANSACTION:originUserId' },
      },
      includeCurrentEntity: true,
    })
    return {
      logic: {
        '>': [{ var: 'agg:receiving' }, parameters.sendersCount],
      },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },

  'R-5': (parameters: FirstActivityAfterLongTimeRuleParameters) => {
    const { dormancyPeriodDays, checkDirection = 'all' } = parameters
    const aggregationVariable: LogicAggregationVariable[] =
      migrateCheckDirectionParameters({
        type: 'COUNT',
        parameters: {
          timeWindow: {
            granularity: 'day',
            units: dormancyPeriodDays,
            rollingBasis: true,
          },
          checkSender: checkDirection,
          checkReceiver: 'none',
        },
      }).logicAggregationVariables

    aggregationVariable.push({
      key: 'agg:transactionsCount',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection:
        checkDirection === 'all' ? 'SENDING_RECEIVING' : 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    const conditions: any[] = []

    const v = aggregationVariable[0]
    conditions.push({
      '==': [{ var: v.key }, 1],
    })

    conditions.push({
      '>': [{ var: 'agg:transactionsCount' }, 1],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: aggregationVariable,
      alertCreationDirection: 'ORIGIN',
    }
  },
  'R-77': (parameters: TooManyTransactionsToHighRiskCountryRuleParameters) => {
    const { logicAggregationVariables, alertCreationDirection } =
      migrateCheckDirectionParameters({ type: 'COUNT', parameters })

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

    const { highRiskCountries, highRiskCountriesExclusive } = parameters

    const orConditions: any[] = []

    ;['origin', 'destination'].forEach((direction) => {
      if (highRiskCountries?.length) {
        orConditions.push({
          in: [
            { var: `TRANSACTION:${direction}AmountDetails-country` },
            expandCountryGroup(highRiskCountries),
          ],
        })
      }

      if (highRiskCountriesExclusive?.length) {
        orConditions.push({
          '!': {
            in: [
              { var: `TRANSACTION:${direction}AmountDetails-country` },
              expandCountryGroup(highRiskCountriesExclusive),
            ],
          },
        })
      }
    })

    conditions.push({
      or: orConditions,
    })

    // TODO (V8): Implement Initial Transactions Threshold Parameter

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },
  'R-13': (parameters: MerchantReceiverNameRuleParameters) => {
    const conditions: any[] = []

    conditions.push({
      '==': [
        {
          var: 'TRANSACTION:destinationPaymentDetails-method',
        },
        'WALLET',
      ],
    })

    conditions.push({
      '!=': [
        {
          var: 'TRANSACTION:destinationPaymentDetails-name',
        },
        null,
      ],
    })

    conditions.push({
      'op:contains': [
        {
          var: 'TRANSACTION:destinationPaymentDetails-name',
        },
        parameters.merchantNames,
      ],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'DESTINATION',
    }
  },
  'R-22': (parameters: BlacklistCardIssuedCountryRuleParameters) => {
    const conditions: any[] = []

    conditions.push({
      or: ['origin', 'destination'].map((direction) => ({
        and: [
          {
            '==': [
              { var: `TRANSACTION:${direction}PaymentDetails-method` },
              'CARD',
            ],
          },
          {
            in: [
              {
                var: `TRANSACTION:${direction}PaymentDetails-cardIssuedCountry`,
              },
              parameters.blacklistedCountries,
            ],
          },
        ],
      })),
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'AUTO',
    }
  },

  'R-9': (parameters: MultipleSendersWithinTimePeriodRuleParameters) => {
    const logicAggregationVariables: LogicAggregationVariable[] = []
    const alertCreationDirection: AlertCreationDirection = 'ORIGIN'

    logicAggregationVariables.push({
      key: 'agg:sending',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:originUserId',
      aggregationFunc: 'UNIQUE_COUNT',
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      filtersLogic: {
        '!=': { var: 'TRANSACTION:originUserId' },
      },
      includeCurrentEntity: true,
    })
    return {
      logic: {
        '>': [{ var: 'agg:sending' }, parameters.sendersCount],
      },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },
  'R-6': (parameters: HighRiskCurrencyRuleParameters) => {
    const conditions: any[] = []

    conditions.push({
      or: ['origin', 'destination'].map((direction) => ({
        in: [
          {
            var: `TRANSACTION:${direction}AmountDetails-transactionCurrency`,
          },
          parameters.highRiskCurrencies,
        ],
      })),
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'AUTO',
    }
  },
  'R-2': (parameters: TransactionAmountRuleParameters) => {
    const [currency, threshold] = Object.entries(
      parameters.transactionAmountThreshold
    )[0]
    return {
      logic: {
        and: [
          {
            '>=': [
              { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
              threshold,
            ],
          },
        ],
      },
      logicAggregationVariables: [],
      alertCreationDirection: 'ALL',
      baseCurrency: currency as CurrencyCode,
    }
  },
  'R-117': (parameters: TransactionMatchesPatternRuleParameters) => {
    const variable = 'TRANSACTION:originAmountDetails-transactionAmount'
    const innerCondition = parameters.checkDecimal
      ? { var: variable }
      : {
          truncate_decimal: [
            {
              var: variable,
            },
          ],
        }
    return {
      logic: {
        and: [
          {
            'op:endswith': [
              {
                number_to_string: [innerCondition],
              },
              parameters.patterns,
            ],
          },
        ],
      },
      alertCreationDirection: 'ORIGIN',
      logicAggregationVariables: [],
      baseCurrency: 'USD',
    }
  },
  'R-69': (parameters: TransactionsVolumeRuleParameters) => {
    const {
      logicAggregationVariables: amountLogicAggregationVariables,
      alertCreationDirection,
    } = migrateCheckDirectionParameters({ type: 'AMOUNT', parameters })

    const [currency, lowerThreshold] = Object.entries(
      parameters.transactionVolumeThreshold
    )[0]
    let logicAggregationVariables = amountLogicAggregationVariables.map(
      (v) => ({
        ...v,
        baseCurrency: currency as CurrencyCode,
      })
    ) as LogicAggregationVariable[]
    const conditions: any[] = []
    let counterPartyAggVariables: LogicAggregationVariable[] | undefined
    if (
      parameters.transactionsCounterPartiesThreshold
        ?.transactionsCounterPartiesCount
    ) {
      const checkPaymentMethodDetails =
        parameters.transactionsCounterPartiesThreshold.checkPaymentMethodDetails
      counterPartyAggVariables = amountLogicAggregationVariables.map((v, i) => {
        let aggregationFieldKey: string | undefined
        let secondaryAggregationFieldKey: string | undefined
        if (v.transactionDirection === 'SENDING') {
          aggregationFieldKey = checkPaymentMethodDetails
            ? 'TRANSACTION:destinationPaymentDetailsIdentifier'
            : 'TRANSACTION:destinationUserId'
        } else if (v.transactionDirection === 'RECEIVING') {
          aggregationFieldKey = checkPaymentMethodDetails
            ? 'TRANSACTION:originPaymentDetailsIdentifier'
            : 'TRANSACTION:originUserId'
        } else {
          aggregationFieldKey = checkPaymentMethodDetails
            ? 'TRANSACTION:destinationPaymentDetailsIdentifier'
            : 'TRANSACTION:destinationUserId'
          secondaryAggregationFieldKey = checkPaymentMethodDetails
            ? 'TRANSACTION:originPaymentDetailsIdentifier'
            : 'TRANSACTION:originUserId'
        }
        return {
          ...v,
          key: `agg:counterparty-${i}`,
          type: checkPaymentMethodDetails
            ? 'PAYMENT_DETAILS_TRANSACTIONS'
            : 'USER_TRANSACTIONS',
          aggregationFieldKey,
          secondaryAggregationFieldKey,
          aggregationFunc: 'UNIQUE_COUNT',
        }
      })
      logicAggregationVariables.push(...counterPartyAggVariables)
    }
    if (parameters.initialTransactions) {
      const { logicAggregationVariables: countLogicAggregationVariables } =
        migrateCheckDirectionParameters({ type: 'COUNT', parameters })
      countLogicAggregationVariables[0].key = 'agg:count'
      logicAggregationVariables = logicAggregationVariables.concat(
        countLogicAggregationVariables
      )
      conditions.push({
        '>': [{ var: 'agg:count' }, parameters.initialTransactions],
      })
    }
    if (amountLogicAggregationVariables.length === 1) {
      conditions.push({
        '>=': [{ var: amountLogicAggregationVariables[0].key }, lowerThreshold],
      })
      if (counterPartyAggVariables) {
        conditions.push({
          '>=': [
            { var: counterPartyAggVariables?.[0].key },
            parameters.transactionsCounterPartiesThreshold
              ?.transactionsCounterPartiesCount,
          ],
        })
      }
    } else if (amountLogicAggregationVariables.length > 1) {
      if (counterPartyAggVariables) {
        conditions.push({
          or: amountLogicAggregationVariables.map((v, i) => ({
            and: [
              {
                '>=': [{ var: v.key }, lowerThreshold],
              },
              {
                '>=': [
                  { var: counterPartyAggVariables?.[i].key },
                  parameters.transactionsCounterPartiesThreshold
                    ?.transactionsCounterPartiesCount,
                ],
              },
            ],
          })),
        })
      } else {
        conditions.push({
          or: amountLogicAggregationVariables.map((v) => ({
            '>=': [{ var: v.key }, lowerThreshold],
          })),
        })
      }
    }
    if (parameters.transactionVolumeUpperThreshold) {
      const [_, upperThreshold] = Object.entries(
        parameters.transactionVolumeUpperThreshold
      )[0]
      if (amountLogicAggregationVariables.length === 1) {
        conditions.push({
          '<': [
            { var: amountLogicAggregationVariables[0].key },
            upperThreshold,
          ],
        })
      } else if (amountLogicAggregationVariables.length > 1) {
        conditions.push({
          or: amountLogicAggregationVariables.map((v) => ({
            '<': [{ var: v.key }, upperThreshold],
          })),
        })
      }
    }
    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection,
    }
  },
  'R-24': (parameters: TransactionReferenceKeywordRuleParameters) => {
    const conditions: any[] = []

    conditions.push({
      'op:similartowords': [
        { var: 'TRANSACTION:reference' },
        parameters.keywords,
        [
          parameters?.allowedDistancePercentage != null
            ? parameters.allowedDistancePercentage
            : 0,
        ],
      ],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'ORIGIN',
    }
  },
  'R-27': (params) => DEVIATION_RULE_MIGRATION('AMOUNT', 'SUM', false, params),
  'R-120': (params) => DEVIATION_RULE_MIGRATION('AMOUNT', 'AVG', false, params),
  'R-121': (params) => DEVIATION_RULE_MIGRATION('COUNT', 'COUNT', true, params),
  'R-122': (params) => DEVIATION_RULE_MIGRATION('AMOUNT', 'SUM', true, params),
  'R-4': (params: TransactionNewCurrencyRuleParameters) => {
    const { initialTransactions } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    // all sending transactions count
    logicAggregationVariables.push({
      key: 'agg:sending',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'COUNT',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      transactionDirection: 'SENDING',
      includeCurrentEntity: false,
    })

    // all receiving transactions count
    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'COUNT',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      transactionDirection: 'RECEIVING',
      includeCurrentEntity: false,
    })

    // all unique sending currencies
    logicAggregationVariables.push({
      key: 'agg:senderCurrencies$2',
      type: 'USER_TRANSACTIONS',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'UNIQUE_VALUES',
      aggregationFieldKey:
        'TRANSACTION:destinationAmountDetails-transactionCurrency',
      transactionDirection: 'SENDING',
      userDirection: 'SENDER',
      filtersLogic: {
        and: [
          {
            '==': [{ var: 'TRANSACTION:transactionState' }, 'SUCCESSFUL'],
          },
        ],
      },
      includeCurrentEntity: false,
    })

    // all unique receiving currencies
    logicAggregationVariables.push({
      key: 'agg:receiverCurrencies$2',
      type: 'USER_TRANSACTIONS',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'UNIQUE_VALUES',
      aggregationFieldKey:
        'TRANSACTION:originAmountDetails-transactionCurrency',
      transactionDirection: 'RECEIVING',
      userDirection: 'RECEIVER',
      filtersLogic: {
        and: [
          {
            '==': [{ var: 'TRANSACTION:transactionState' }, 'SUCCESSFUL'],
          },
        ],
      },
      includeCurrentEntity: false,
    })

    const logic: object = {
      or: [
        {
          and: [
            {
              '!=': [
                {
                  var: 'TRANSACTION:destinationAmountDetails-transactionCurrency',
                },
                null,
              ],
            },
            {
              '>=': [{ var: 'agg:sending' }, initialTransactions],
            },
            {
              '!': {
                in: [
                  {
                    var: 'TRANSACTION:destinationAmountDetails-transactionCurrency',
                  },
                  { var: 'agg:senderCurrencies$2' },
                ],
              },
            },
          ],
        },
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:originAmountDetails-transactionCurrency' },
                null,
              ],
            },
            {
              '>=': [{ var: 'agg:receiving' }, initialTransactions],
            },
            {
              '!': {
                in: [
                  {
                    var: 'TRANSACTION:originAmountDetails-transactionCurrency',
                  },
                  { var: 'agg:receiverCurrencies$2' },
                ],
              },
            },
          ],
        },
      ],
    }

    return {
      logic: { and: [logic] },
      logicAggregationVariables,
    }
  },
  'R-3': (params: TransactionNewCountryRuleParameters) => {
    const { initialTransactions } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    // all sending transactions count
    logicAggregationVariables.push({
      key: 'agg:sending',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'COUNT',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      transactionDirection: 'SENDING',
      includeCurrentEntity: false,
    })

    // all receiving transactions count
    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'COUNT',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      transactionDirection: 'RECEIVING',
      includeCurrentEntity: false,
    })

    // all unique sending countries
    logicAggregationVariables.push({
      key: 'agg:senderCountries$2',
      type: 'USER_TRANSACTIONS',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'UNIQUE_VALUES',
      aggregationFieldKey: 'TRANSACTION:destinationAmountDetails-country',
      transactionDirection: 'SENDING',
      userDirection: 'SENDER',
      includeCurrentEntity: false,
      filtersLogic: {
        and: [
          {
            '==': [{ var: 'TRANSACTION:transactionState' }, 'SUCCESSFUL'],
          },
        ],
      },
    })

    // all unique receiving countries
    logicAggregationVariables.push({
      key: 'agg:receiverCountries$2',
      type: 'USER_TRANSACTIONS',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      aggregationFunc: 'UNIQUE_VALUES',
      aggregationFieldKey: 'TRANSACTION:originAmountDetails-country',
      transactionDirection: 'RECEIVING',
      userDirection: 'RECEIVER',
      includeCurrentEntity: false,
      filtersLogic: {
        and: [
          {
            '==': [{ var: 'TRANSACTION:transactionState' }, 'SUCCESSFUL'],
          },
        ],
      },
    })

    const logic: object = {
      or: [
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:destinationAmountDetails-country' },
                null,
              ],
            },
            {
              '>=': [{ var: 'agg:sending' }, initialTransactions],
            },
            {
              '!': {
                in: [
                  { var: 'TRANSACTION:destinationAmountDetails-country' },
                  { var: 'agg:senderCountries$2' },
                ],
              },
            },
          ],
        },
        {
          and: [
            {
              '!=': [{ var: 'TRANSACTION:originAmountDetails-country' }, null],
            },
            {
              '>=': [{ var: 'agg:receiving' }, initialTransactions],
            },
            {
              '!': {
                in: [
                  { var: 'TRANSACTION:originAmountDetails-country' },
                  { var: 'agg:receiverCountries$2' },
                ],
              },
            },
          ],
        },
      ],
    }

    return {
      logic: { and: [logic] },
      logicAggregationVariables,
    }
  },

  'R-88': (params: IpAddressUnexpectedLocationRuleParameters) => {
    const { transactionAmountThreshold } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:userTransactionsCountries$2',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originAmountDetails-country',
      aggregationFunc: 'UNIQUE_VALUES',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: false,
    })

    const conditions: any[] = []

    let baseCurrency: CurrencyCode = 'USD'

    if (transactionAmountThreshold) {
      const [currency, threshold] = Object.entries(
        transactionAmountThreshold
      )[0]

      if (threshold != null) {
        baseCurrency = currency as unknown as CurrencyCode

        conditions.push({
          '>=': [
            { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
            threshold,
          ],
        })
      }
    }

    conditions.push({
      '!=': [{ var: 'TRANSACTION:originIpCountry' }, null],
    })

    conditions.push({
      '!=': [
        { var: 'CONSUMER_USER:userDetails-countryOfResidence__SENDER' },
        { var: 'TRANSACTION:originIpCountry' },
      ],
    })

    conditions.push({
      '!=': [
        { var: 'CONSUMER_USER:userDetails-countryOfNationality__SENDER' },
        { var: 'TRANSACTION:originIpCountry' },
      ],
    })

    conditions.push({
      '!': {
        in: [
          { var: 'TRANSACTION:originIpCountry' },
          { var: 'agg:userTransactionsCountries$2' },
        ],
      },
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'ORIGIN',
      baseCurrency,
    }
  },
  'R-131': (params: TransactionsExceedPastPeriodRuleParameters) => {
    const {
      multiplierThreshold,
      checkSender,
      checkReceiver,
      initialTransactions,
      minTransactionsInTimeWindow2,
      minTransactionsInTimeWindow1,
      timeWindow2,
      timeWindow1,
    } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []
    const allTimeTransactionsCount: LogicAggregationVariable = {
      key: 'agg:allTimeTransactionsCount',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'COUNT',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      secondaryAggregationFieldKey: 'TRANSACTION:transactionId',
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    }

    const { logicAggregationVariables: period1LogicAggregationVariables } =
      migrateCheckDirectionParameters({
        type: 'COUNT',
        parameters: {
          timeWindow: timeWindow1,
          checkSender,
          checkReceiver,
        },
      })

    const { logicAggregationVariables: period2LogicAggregationVariables } =
      migrateCheckDirectionParameters({
        type: 'COUNT',
        parameters: {
          timeWindow: timeWindow2,
          checkSender,
          checkReceiver,
        },
      })

    logicAggregationVariables.push(
      allTimeTransactionsCount,
      ...period1LogicAggregationVariables,
      ...period2LogicAggregationVariables
    )

    const conditions: any[] = []

    if (minTransactionsInTimeWindow1) {
      conditions.push({
        or: period1LogicAggregationVariables.map((v) => ({
          '>=': [{ var: v.key }, minTransactionsInTimeWindow1],
        })),
      })
    }

    if (minTransactionsInTimeWindow2) {
      conditions.push({
        or: period2LogicAggregationVariables.map((v, i) => ({
          '>=': [
            {
              '-': [
                { var: v.key },
                { var: period1LogicAggregationVariables[i].key },
              ],
            },
            minTransactionsInTimeWindow2,
          ],
        })),
      })
    }

    if (initialTransactions) {
      conditions.push({
        '>=': [{ var: allTimeTransactionsCount.key }, initialTransactions],
      })
    }

    conditions.push({
      or: period1LogicAggregationVariables.map((v, i) => ({
        '>=': [
          { var: v.key },
          {
            '*': [
              multiplierThreshold,
              {
                '-': [
                  { var: period2LogicAggregationVariables[i].key },
                  { var: v.key },
                ],
              },
            ],
          },
        ],
      })),
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
}

export const V8_MIGRATED_RULES = Object.keys(V8_CONVERSION)
