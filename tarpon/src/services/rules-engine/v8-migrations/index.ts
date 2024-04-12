import { pickBy } from 'lodash'
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
import { getFiltersConditions, migrateCheckDirectionParameters } from './utils'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'

export function getMigratedV8Config(
  ruleId: string,
  parameters: any = {},
  filters: LegacyFilters = {}
): {
  logic: object
  logicAggregationVariables: RuleAggregationVariable[]
  alertCreationDirection?: AlertCreationDirection
  baseCurrency?: CurrencyCode
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

  if (filterConditions.length > 0) {
    result.logic = {
      and: [{ and: filterConditions }, result.logic],
    }
  }
  if (result.logicAggregationVariables.length > 0) {
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
  return result
}

const V8_CONVERSION: {
  [ruleId: string]: (
    parameters: any,
    filters: TransactionHistoricalFilters
  ) => {
    logic: object
    logicAggregationVariables: RuleAggregationVariable[]
    alertCreationDirection?: AlertCreationDirection
    baseCurrency?: CurrencyCode
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
  'R-77': (
    parameters: TooManyTransactionsToHighRiskCountryRuleParameters,
    filters
  ) => {
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
    const logicAggregationVariables: RuleAggregationVariable[] = []
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
    }
  },
  'R-69': (parameters: TransactionsVolumeRuleParameters, filters) => {
    const {
      logicAggregationVariables: amountLogicAggregationVariables,
      alertCreationDirection,
    } = migrateCheckDirectionParameters('AMOUNT', parameters, filters)

    const [currency, lowerThreshold] = Object.entries(
      parameters.transactionVolumeThreshold
    )[0]
    let logicAggregationVariables = amountLogicAggregationVariables.map(
      (v) => ({
        ...v,
        baseCurrency: currency as CurrencyCode,
      })
    ) as RuleAggregationVariable[]
    const conditions: any[] = []
    if (
      parameters.transactionsCounterPartiesThreshold
        ?.transactionsCounterPartiesCount
    ) {
      const checkPaymentMethodDetails =
        parameters.transactionsCounterPartiesThreshold.checkPaymentMethodDetails
      const counterPartyAggVariable: RuleAggregationVariable = {
        key: 'agg:counterparty',
        type: checkPaymentMethodDetails
          ? 'PAYMENT_DETAILS_TRANSACTIONS'
          : 'USER_TRANSACTIONS',
        userDirection: 'SENDER_OR_RECEIVER',
        transactionDirection: 'SENDING_RECEIVING',
        aggregationFieldKey: checkPaymentMethodDetails
          ? 'TRANSACTION:destinationPaymentDetailsIdentifier'
          : 'TRANSACTION:destinationUserId',
        secondaryAggregationFieldKey: checkPaymentMethodDetails
          ? 'TRANSACTION:originPaymentDetailsIdentifier'
          : 'TRANSACTION:originUserId',
        timeWindow: {
          start: parameters.timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        aggregationFunc: 'UNIQUE_COUNT',
        baseCurrency: currency as CurrencyCode,
      }
      logicAggregationVariables.push(counterPartyAggVariable)
      conditions.push({
        '>=': [
          { var: counterPartyAggVariable.key },
          parameters.transactionsCounterPartiesThreshold
            .transactionsCounterPartiesCount,
        ],
      })
    }
    if (parameters.initialTransactions) {
      const { logicAggregationVariables: countLogicAggregationVariables } =
        migrateCheckDirectionParameters('COUNT', parameters, filters)
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
    } else if (amountLogicAggregationVariables.length > 1) {
      conditions.push({
        or: amountLogicAggregationVariables.map((v) => ({
          '>=': [{ var: v.key }, lowerThreshold],
        })),
      })
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
      logicAggregationVariables: logicAggregationVariables,
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
}
