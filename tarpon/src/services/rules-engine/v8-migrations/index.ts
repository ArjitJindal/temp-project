import isEmpty from 'lodash/isEmpty'
import pickBy from 'lodash/pickBy'
import zip from 'lodash/zip'
import { expandCountryGroup } from '@flagright/lib/constants/countries'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
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
import { LowValueTransactionsRuleParameters } from '../transaction-rules/low-value-transactions-base'
import { UsingTooManyBanksToMakePaymentsRuleParameters } from '../transaction-rules/using-too-many-banks-to-make-payments'
import { TransactionsOutflowInflowVolumeRuleParameters } from '../transaction-rules/transactions-outflow-inflow-volume'
import { SenderLocationChangesFrequencyRuleParameters } from '../transaction-rules/sender-location-changes-frequency'
import { HighRiskIpAddressCountriesParameters } from '../transaction-rules/high-risk-ip-address-countries'
import { PaymentDetailChangeRuleParameters } from '../transaction-rules/payment-detail-change-base'
import { SameUserUsingTooManyPaymentIdentifiersParameters } from '../transaction-rules/same-user-using-too-many-payment-identifiers'
import { TransactionsPatternPercentageRuleParameters } from '../transaction-rules/transactions-pattern-percentage-base'
import { SamePaymentDetailsParameters } from '../transaction-rules/same-payment-details'
import { BlacklistPaymentdetailsRuleParameters } from '../transaction-rules/blacklist-payment-details'
import { PaymentMethodNameRuleParameter } from '../transaction-rules/payment-method-name-levensthein-distance'
import { BlacklistTransactionMatchedFieldRuleParameters } from '../transaction-rules/blacklist-transaction-related-value'
import { TransactionsRoundValueVelocityRuleParameters } from '../transaction-rules/transactions-round-value-velocity'
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
import { LogicAggregationUserDirection } from '@/@types/openapi-internal/LogicAggregationUserDirection'

export type RuleMigrationConfig = {
  logic: object
  logicAggregationVariables: LogicAggregationVariable[]
  alertCreationDirection?: AlertCreationDirection
  baseCurrency?: CurrencyCode
}

export function getMigratedV8Config(
  ruleId: string,
  parameters: any = {},
  filters: LegacyFilters = {},
  context?: {
    tenantId: string
    dynamoDb: DynamoDBDocumentClient
  }
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
    // For R-132, we need to pass context through parameters
    const paramsWithContext =
      ruleId === 'R-132' ? { ...parameters, context } : parameters
    result = migrationFunc(paramsWithContext)
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
  'R-7': (params: LowValueTransactionsRuleParameters) => {
    const { lowTransactionValues, lowTransactionCount } = params
    const currency = Object.keys(lowTransactionValues)[0]
    const { min, max } = lowTransactionValues[currency]

    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:transactionsWithLowValueFilterIncoming$1',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      lastNEntities: lowTransactionCount,
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        '<=': [
          min,
          { var: 'TRANSACTION:destinationAmountDetails-transactionAmount' },
          max,
        ],
      },
    })
    logicAggregationVariables.push({
      key: 'agg:transactionsWithoutLowValueFilterIncoming$1',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      lastNEntities: lowTransactionCount,
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    let baseCurrency: CurrencyCode = 'USD'

    if (currency) {
      baseCurrency = currency as unknown as CurrencyCode
    }

    const conditions: any[] = []

    conditions.push({
      'op:equalArray': [
        { var: 'agg:transactionsWithLowValueFilterIncoming$1' },
        { var: 'agg:transactionsWithoutLowValueFilterIncoming$1' },
      ],
    })

    conditions.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:transactionsWithLowValueFilterIncoming$1',
            },
          ],
        },
        lowTransactionCount,
      ],
    })
    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'DESTINATION',
      baseCurrency,
    }
  },
  'R-8': (params: LowValueTransactionsRuleParameters) => {
    const { lowTransactionValues, lowTransactionCount } = params
    const currency = Object.keys(lowTransactionValues)[0]
    const { min, max } = lowTransactionValues[currency]

    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:transactionsWithLowValueFilterOutgoing$1',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      lastNEntities: lowTransactionCount,
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        '<=': [
          min,
          { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
          max,
        ],
      },
    })
    logicAggregationVariables.push({
      key: 'agg:transactionsWithoutLowValueFilterOutgoing$1',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      lastNEntities: lowTransactionCount,
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    let baseCurrency: CurrencyCode = 'USD'

    if (currency) {
      baseCurrency = currency as unknown as CurrencyCode
    }

    const conditions: any[] = []

    conditions.push({
      'op:equalArray': [
        { var: 'agg:transactionsWithLowValueFilterOutgoing$1' },
        { var: 'agg:transactionsWithoutLowValueFilterOutgoing$1' },
      ],
    })

    conditions.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:transactionsWithLowValueFilterOutgoing$1',
            },
          ],
        },
        lowTransactionCount,
      ],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'ORIGIN',
      baseCurrency,
    }
  },
  'R-113': (params: SenderLocationChangesFrequencyRuleParameters) => {
    const { uniqueCitiesCountThreshold, timeWindow } = params

    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:userTransactionsCountriesSender$1',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originDeviceData-ipAddress',
      aggregationFunc: 'UNIQUE_VALUES',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })
    logicAggregationVariables.push({
      key: 'agg:userTransactionsCountriesReciever$2',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:destinationDeviceData-ipAddress',
      aggregationFunc: 'UNIQUE_VALUES',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    const conditions: any[] = []

    conditions.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:userTransactionsCountriesSender$1',
            },
          ],
        },
        uniqueCitiesCountThreshold + 1,
      ],
    })
    conditions.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:userTransactionsCountriesReciever$2',
            },
          ],
        },
        uniqueCitiesCountThreshold + 1,
      ],
    })

    return {
      logic: { or: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-87': (params: HighRiskIpAddressCountriesParameters) => {
    const { highRiskCountries } = params

    const conditions: any[] = []

    conditions.push({
      in: [
        {
          var: 'TRANSACTION:ipCountry__BOTH',
        },
        highRiskCountries,
      ],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'AUTO',
    }
  },
  'R-41': (params: TransactionsOutflowInflowVolumeRuleParameters) => {
    const {
      timeWindow,
      outflowTransactionTypes,
      inflowTransactionTypes,
      outflowInflowComparator,
      outflow3dsDonePercentageThreshold,
      inflow3dsDonePercentageThreshold,
    } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:transactionsOutFlowAggSum',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'SUM',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originAmountDetails-transactionAmount',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        in: [
          {
            var: 'TRANSACTION:type',
          },
          outflowTransactionTypes,
        ],
      },
    })
    logicAggregationVariables.push({
      key: 'agg:transactionsInFlowAggSum',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'SUM',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey:
        'TRANSACTION:destinationAmountDetails-transactionAmount',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        in: [{ var: 'TRANSACTION:type' }, inflowTransactionTypes],
      },
    })

    // outflowTransactionCount
    logicAggregationVariables.push({
      key: 'agg:transactionsOutFlowAggCount',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'COUNT',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        in: [
          {
            var: 'TRANSACTION:type',
          },
          outflowTransactionTypes,
        ],
      },
    })

    //inflowTransactionCount
    logicAggregationVariables.push({
      key: 'agg:transactionsInFlowAggCount',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'COUNT',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        in: [{ var: 'TRANSACTION:type' }, inflowTransactionTypes],
      },
    })
    // outflowTransactionCount3dsDone
    logicAggregationVariables.push({
      key: 'agg:transactionsOutFlowAggCount3dsDone',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'COUNT',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        and: [
          {
            in: [{ var: 'TRANSACTION:type' }, outflowTransactionTypes],
          },
          {
            '==': [{ var: 'TRANSACTION:originPaymentDetails-3dsDone' }, true],
          },
        ],
      },
    })
    // inflowTransactionCount3dsDone
    logicAggregationVariables.push({
      key: 'agg:transactionsInFlowAggCount3dsDone',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'COUNT',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        and: [
          {
            in: [{ var: 'TRANSACTION:type' }, inflowTransactionTypes],
          },
          {
            '==': [
              { var: 'TRANSACTION:destinationPaymentDetails-3dsDone' },
              true,
            ],
          },
        ],
      },
    })

    const conditions: any[] = []

    if (outflowInflowComparator == 'GREATER_THAN_OR_EQUAL_TO') {
      conditions.push({
        and: [
          {
            '>=': [
              { var: 'agg:transactionsOutFlowAggSum' },
              { var: 'agg:transactionsInFlowAggSum' },
            ],
          },
          {
            '!=': [{ var: 'agg:transactionsOutFlowAggSum' }, 0],
          },
          {
            '!=': [{ var: 'agg:transactionsInFlowAggSum' }, 0],
          },
        ],
      })
    } else if (outflowInflowComparator == 'LESS_THAN_OR_EQUAL_TO') {
      conditions.push({
        and: [
          {
            '<=': [
              { var: 'agg:transactionsOutFlowAggSum' },
              { var: 'agg:transactionsInFlowAggSum' },
            ],
          },
          {
            '!=': [{ var: 'agg:transactionsOutFlowAggSum' }, 0],
          },
          {
            '!=': [{ var: 'agg:transactionsInFlowAggSum' }, 0],
          },
        ],
      })
    }

    if (outflow3dsDonePercentageThreshold) {
      const {
        value: valueOutflow3DsDone,
        comparator: comparatorOutflow3DsDone,
      } = outflow3dsDonePercentageThreshold

      conditions.push({
        [comparatorOutflow3DsDone === 'GREATER_THAN_OR_EQUAL_TO' ? '>=' : '<=']:
          [
            {
              '*': [
                {
                  '/': [
                    { var: 'agg:transactionsOutFlowAggCount3dsDone' },
                    { var: 'agg:transactionsOutFlowAggCount' },
                  ],
                },
                100,
              ],
            },
            valueOutflow3DsDone,
          ],
      })
    }
    if (inflow3dsDonePercentageThreshold) {
      const { value: valueInflow3DsDone, comparator: comparatorInflow3DsDone } =
        inflow3dsDonePercentageThreshold
      conditions.push({
        [comparatorInflow3DsDone === 'GREATER_THAN_OR_EQUAL_TO' ? '>=' : '<=']:
          [
            {
              '*': [
                {
                  '/': [
                    { var: 'agg:transactionsInFlowAggCount3dsDone' },
                    { var: 'agg:transactionsInFlowAggCount' },
                  ],
                },
                100,
              ],
            },
            valueInflow3DsDone,
          ],
      })
    }

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-45': (params: PaymentDetailChangeRuleParameters) => {
    const {
      timeWindow,
      oldNamesThreshold,
      initialTransactions,
      ignoreEmptyName,
    } = params

    // agg bank unique names
    // check with count

    const logicAggregationVariables: LogicAggregationVariable[] = []
    logicAggregationVariables.push({
      key: 'agg:transactionWithUniqueBanksNamesSender$1',
      type: 'USER_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'SENDER_OR_RECEIVER',
      lastNEntities: oldNamesThreshold + 1,
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originPaymentDetails-name',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: ignoreEmptyName
        ? {
            '!=': [
              {
                var: 'TRANSACTION:originPaymentDetails-name',
              },
              '',
            ],
          }
        : undefined,
    })
    logicAggregationVariables.push({
      key: 'agg:transactionWithUniqueBanksNamesReceiver$1',
      type: 'PAYMENT_DETAILS_TRANSACTIONS',
      aggregationFunc: 'UNIQUE_VALUES',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'RECEIVING',
      lastNEntities: oldNamesThreshold + 1,
      aggregationFieldKey: 'TRANSACTION:destinationPaymentDetails-name',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: ignoreEmptyName
        ? {
            '!=': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-name',
              },
              '',
            ],
          }
        : undefined,
    })

    logicAggregationVariables.push({
      key: 'agg:transactionsCount',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    const conditions1: any[] = []

    conditions1.push({
      '==': [
        {
          var: 'TRANSACTION:destinationPaymentDetails-method',
        },
        'GENERIC_BANK_ACCOUNT',
      ],
    })
    conditions1.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:transactionWithUniqueBanksNamesReceiver$1',
            },
          ],
        },
        oldNamesThreshold + 1,
      ],
    })

    const conditions2: any[] = []

    conditions2.push({
      '==': [
        { var: 'TRANSACTION:originPaymentDetails-method' },
        'GENERIC_BANK_ACCOUNT',
      ],
    })
    conditions2.push({
      '>=': [
        {
          number_of_items: [
            {
              var: 'agg:transactionWithUniqueBanksNamesSender$1',
            },
          ],
        },
        oldNamesThreshold + 1,
      ],
    })

    const conditions: any[] = []
    conditions.push({
      and: [
        { or: [{ and: conditions1 }, { and: conditions2 }] },
        {
          '>=': [{ var: 'agg:transactionsCount' }, initialTransactions],
        },
      ],
    })
    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-14': (params: HighRiskIpAddressCountriesParameters) => {
    const conditions: any[] = []

    conditions.push({
      or: ['origin', 'destination'].map((direction) => ({
        in: [
          {
            var: `TRANSACTION:${direction}AmountDetails-country`,
          },
          params.highRiskCountries,
        ],
      })),
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables: [],
      alertCreationDirection: 'AUTO',
    }
  },
  'R-15': (params: UsingTooManyBanksToMakePaymentsRuleParameters) => {
    const {
      checkSender,
      checkReceiver,
      banksLimit,
      timeWindow,
      onlyCheckKnownUsers,
    } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    if (checkSender !== 'none') {
      logicAggregationVariables.push({
        key: 'agg:transactionWithUniqueBanksNamesSender$1',
        type: 'USER_TRANSACTIONS',
        aggregationFunc: 'UNIQUE_VALUES',
        userDirection:
          checkSender !== 'sending' ? 'SENDER_OR_RECEIVER' : 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:originPaymentDetails-bankName',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
      })
    }
    if (checkReceiver !== 'none') {
      logicAggregationVariables.push({
        key: 'agg:transactionWithUniqueBanksNamesReceiver$1',
        type: 'USER_TRANSACTIONS',
        aggregationFunc: 'UNIQUE_VALUES',
        userDirection:
          checkReceiver !== 'receiving' ? 'SENDER_OR_RECEIVER' : 'RECEIVER',
        transactionDirection: 'RECEIVING',
        aggregationFieldKey: 'TRANSACTION:destinationPaymentDetails-bankName',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
      })
    }

    const conditions: any[] = []

    if (checkSender == 'none' && checkReceiver !== 'none') {
      conditions.push({
        '>=': [
          {
            number_of_items: [
              {
                var: 'agg:transactionWithUniqueBanksNamesReceiver$1',
              },
            ],
          },
          banksLimit + 1,
        ],
      })
    } else if (checkSender !== 'none' && checkReceiver == 'none') {
      conditions.push({
        '>=': [
          {
            number_of_items: [
              {
                var: 'agg:transactionWithUniqueBanksNamesSender$1',
              },
            ],
          },
          banksLimit + 1,
        ],
      })
    } else if (checkSender !== 'none' && checkReceiver !== 'none') {
      conditions.push({
        '>=': [
          {
            '+': [
              {
                number_of_items: [
                  {
                    var: 'agg:transactionWithUniqueBanksNamesSender$1',
                  },
                ],
              },
              {
                number_of_items: [
                  {
                    var: 'agg:transactionWithUniqueBanksNamesReceiver$1',
                  },
                ],
              },
            ],
          },
          banksLimit + 1,
        ],
      })
    }

    if (onlyCheckKnownUsers) {
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

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-132': (params: BlacklistTransactionMatchedFieldRuleParameters) => {
    const { blacklistId } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []

    const conditions: any[] = []
    // User ID
    conditions.push({
      'op:contains_in_lists_subtype': [
        {
          var: 'TRANSACTION:originUserId',
        },
        blacklistId,
        'USER_ID',
      ],
    })
    conditions.push({
      'op:contains_in_lists_subtype': [
        {
          var: 'TRANSACTION:destinationUserId',
        },
        blacklistId,
        'USER_ID',
      ],
    })
    // Card Fingerprint Number
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-cardFingerprint__BOTH',
            },
            blacklistId,
            'CARD_FINGERPRINT_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'CARD',
          ],
        },
      ],
    })

    // IBAN Number
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-IBAN__BOTH',
            },
            blacklistId,
            'IBAN_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'IBAN',
          ],
        },
      ],
    })

    // ACH Account Number
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-accountNumber__BOTH',
            },
            blacklistId,
            'ACH_ACCOUNT_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'ACH',
          ],
        },
      ],
    })

    // SWIFT Account Number
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-accountNumber__BOTH',
            },
            blacklistId,
            'SWIFT_ACCOUNT_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'SWIFT',
          ],
        },
      ],
    })

    // BIC
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-BIC__BOTH',
            },
            blacklistId,
            'BIC',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'IBAN',
          ],
        },
      ],
    })

    // BANK_SWIFT_CODE
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-swiftCode__BOTH',
            },
            blacklistId,
            'BANK_SWIFT_CODE',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'SWIFT',
          ],
        },
      ],
    })

    // BANK_ACCOUNT_NUMBER
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-accountNumber__BOTH',
            },
            blacklistId,
            'BANK_ACCOUNT_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'GENERIC_BANK_ACCOUNT',
          ],
        },
      ],
    })

    // UPI_IDENTIFYING_NUMBER
    conditions.push({
      and: [
        {
          'op:contains_in_lists_subtype': [
            {
              var: 'TRANSACTION:paymentDetails-upiID__BOTH',
            },
            blacklistId,
            'UPI_IDENTIFYING_NUMBER',
          ],
        },
        {
          '==': [
            {
              var: 'TRANSACTION:paymentDetails-method__BOTH',
            },
            'UPI',
          ],
        },
      ],
    })

    // COUNTRY
    conditions.push({
      or: [
        {
          and: [
            {
              'op:contains_in_lists_subtype': [
                {
                  var: 'TRANSACTION:paymentDetails-cardIssuedCountry__BOTH',
                },
                blacklistId,
                'COUNTRY',
              ],
            },
            {
              '==': [
                {
                  var: 'TRANSACTION:paymentDetails-method__BOTH',
                },
                'CARD',
              ],
            },
          ],
        },
        {
          and: [
            {
              'op:contains_in_lists_subtype': [
                {
                  var: 'TRANSACTION:paymentDetails-bankAddress-country__BOTH',
                },
                blacklistId,
                'COUNTRY',
              ],
            },
            {
              or: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:paymentDetails-method__BOTH',
                    },
                    'ACH',
                  ],
                },
                {
                  '==': [
                    {
                      var: 'TRANSACTION:paymentDetails-method__BOTH',
                    },
                    'SWIFT',
                  ],
                },
              ],
            },
          ],
        },
        {
          and: [
            {
              'op:contains_in_lists_subtype': [
                {
                  var: 'TRANSACTION:paymentDetails-shippingAddress-country__BOTH',
                },
                blacklistId,
                'COUNTRY',
              ],
            },
            {
              '==': [
                {
                  var: 'TRANSACTION:paymentDetails-method__BOTH',
                },
                'CHECK',
              ],
            },
          ],
        },
        {
          and: [
            {
              'op:contains_in_lists_subtype': [
                {
                  var: 'TRANSACTION:paymentDetails-country__BOTH',
                },
                blacklistId,
                'COUNTRY',
              ],
            },
            {
              or: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:paymentDetails-method__BOTH',
                    },
                    'IBAN',
                  ],
                },
                {
                  '==': [
                    {
                      var: 'TRANSACTION:paymentDetails-method__BOTH',
                    },
                    'GENERIC_BANK_ACCOUNT',
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    return {
      logic: { or: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },

  'R-55': (params: SameUserUsingTooManyPaymentIdentifiersParameters) => {
    const { uniquePaymentIdentifiersCountThreshold, timeWindow } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []
    logicAggregationVariables.push({
      key: 'agg:uniquePaymentIdentifiersCount',
      type: 'PAYMENT_DETAILS_TRANSACTIONS',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey: 'TRANSACTION:originPaymentDetails-identifier',
      aggregationFunc: 'UNIQUE_COUNT',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
    })

    const conditions: any[] = []

    conditions.push({
      '>=': [
        { var: 'agg:uniquePaymentIdentifiersCount' },
        uniquePaymentIdentifiersCountThreshold,
      ],
    })

    return {
      logic: { and: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-124': (params: TransactionsPatternPercentageRuleParameters) => {
    const {
      timeWindow,
      patternPercentageLimit,
      initialTransactions,
      checkSender,
      checkReceiver,
    } = params

    const directions = [
      {
        check: checkSender,
        userDirection: 'SENDER' as LogicAggregationUserDirection,
        primaryAmount: 'originAmountDetails-transactionAmount',
        secondaryAmount: 'destinationAmountDetails-transactionAmount',
        name: 'sender',
      },
      {
        check: checkReceiver,
        userDirection: 'RECEIVER' as LogicAggregationUserDirection,
        primaryAmount: 'destinationAmountDetails-transactionAmount',
        secondaryAmount: 'originAmountDetails-transactionAmount',
        name: 'receiver',
      },
    ]

    const logicAggregationVariables: LogicAggregationVariable[] = []
    const conditionsToEvaluate: any[] = []

    for (const direction of directions) {
      if (direction.check === 'none') {
        continue
      }

      const totalAggVarKey = `agg:${direction.name}TotalTransactions`
      const roundAggVarKey = `agg:${direction.name}RoundValueTransactions`
      const transactionDirection =
        direction.check === 'all'
          ? 'SENDING_RECEIVING'
          : direction.userDirection === 'SENDER'
          ? 'SENDING'
          : 'RECEIVING'

      logicAggregationVariables.push(
        {
          key: totalAggVarKey,
          type: 'USER_TRANSACTIONS',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: timeWindow,
            end: { units: 0, granularity: 'now' },
          },
          includeCurrentEntity: true,
          userDirection: direction.userDirection,
          transactionDirection,
        },
        {
          key: roundAggVarKey,
          type: 'USER_TRANSACTIONS',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: timeWindow,
            end: { units: 0, granularity: 'now' },
          },
          includeCurrentEntity: true,
          userDirection: direction.userDirection,
          transactionDirection,
          filtersLogic: {
            or: [
              {
                '==': [
                  {
                    '%': [
                      {
                        var: `TRANSACTION:${direction.primaryAmount}`,
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
              ...(direction.check === 'all'
                ? [
                    {
                      '==': [
                        {
                          '%': [
                            {
                              var: `TRANSACTION:${direction.secondaryAmount}`,
                            },
                            100,
                          ],
                        },
                        0,
                      ],
                    },
                  ]
                : []),
            ],
          },
        }
      )

      conditionsToEvaluate.push({
        and: [
          {
            '>': [{ var: totalAggVarKey }, initialTransactions],
          },
          {
            '>=': [
              {
                '*': [
                  {
                    '/': [{ var: roundAggVarKey }, { var: totalAggVarKey }],
                  },
                  100,
                ],
              },
              patternPercentageLimit,
            ],
          },
        ],
      })
    }

    return {
      logic:
        conditionsToEvaluate.length > 1
          ? { or: conditionsToEvaluate }
          : conditionsToEvaluate.length === 1
          ? conditionsToEvaluate[0]
          : { and: [false] },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-129': (params: BlacklistPaymentdetailsRuleParameters) => {
    const {
      blacklistedIBANPaymentDetails,
      blacklistedCardPaymentDetails,
      blacklistedGenericBankAccountPaymentDetails,
    } = params
    const logicAggregationVariables: LogicAggregationVariable[] = []
    const conditions: any[] = []
    // IBAN conditions
    if (blacklistedIBANPaymentDetails) {
      conditions.push({
        and: [
          {
            '==': [{ var: 'TRANSACTION:paymentDetails-method__BOTH' }, 'IBAN'],
          },
          {
            in: [
              { var: 'TRANSACTION:paymentDetails-IBAN__BOTH' },
              blacklistedIBANPaymentDetails,
            ],
          },
        ],
      })
    }

    // Generic Bank Account conditions
    if (blacklistedGenericBankAccountPaymentDetails) {
      conditions.push({
        and: [
          {
            '==': [
              { var: 'TRANSACTION:paymentDetails-method__BOTH' },
              'GENERIC_BANK_ACCOUNT',
            ],
          },
          {
            in: [
              { var: 'TRANSACTION:paymentDetails-accountNumber__BOTH' },
              blacklistedGenericBankAccountPaymentDetails,
            ],
          },
        ],
      })
    }

    // // Card conditions
    if (
      blacklistedCardPaymentDetails &&
      blacklistedCardPaymentDetails.length > 0
    ) {
      blacklistedCardPaymentDetails.map((cardPaymentDetails) => {
        const cardInternalConditions: any[] = []

        // Card fingerprint condition
        if (cardPaymentDetails.cardFingerprint) {
          cardInternalConditions.push({
            '==': [
              { var: 'TRANSACTION:paymentDetails-cardFingerprint__BOTH' },
              cardPaymentDetails.cardFingerprint,
            ],
          })
        }
        // Card last 4 digits, expiry and name on card condition
        if (
          cardPaymentDetails.cardLast4Digits &&
          cardPaymentDetails.cardExpiry &&
          cardPaymentDetails.nameOnCard
        ) {
          cardInternalConditions.push({
            and: [
              {
                '==': [
                  { var: 'TRANSACTION:paymentDetails-cardLast4Digits__BOTH' },
                  cardPaymentDetails.cardLast4Digits,
                ],
              },
              {
                '==': [
                  {
                    var: 'TRANSACTION:paymentDetails-cardExpiry-month__BOTH',
                  },
                  cardPaymentDetails.cardExpiry.month,
                ],
              },
              {
                '==': [
                  { var: 'TRANSACTION:paymentDetails-cardExpiry-year__BOTH' },
                  cardPaymentDetails.cardExpiry.year,
                ],
              },
              {
                'op:similarTo': [
                  {
                    concat_string: [
                      {
                        var: 'TRANSACTION:paymentDetails-nameOnCard-firstName__BOTH',
                      },
                      {
                        concat_string: [
                          {
                            var: 'TRANSACTION:paymentDetails-nameOnCard-middleName__BOTH',
                          },
                          {
                            var: 'TRANSACTION:paymentDetails-nameOnCard-lastName__BOTH',
                          },
                        ],
                      },
                    ],
                  },
                  cardPaymentDetails.nameOnCard,
                  [0],
                ],
              },
            ],
          })
        }

        conditions.push({
          and: [
            {
              '==': [
                { var: 'TRANSACTION:paymentDetails-method__BOTH' },
                'CARD',
              ],
            },
            {
              or: cardInternalConditions,
            },
          ],
        })
      })
    }
    return {
      logic: { or: conditions },
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-130': (params: TransactionsRoundValueVelocityRuleParameters) => {
    const {
      timeWindow,
      transactionsLimit,
      sameAmount,
      originMatchPaymentMethodDetails,
      destinationMatchPaymentMethodDetails,
      checkSender,
      checkReceiver,
      initialTransactions,
    } = params

    const roundfilter = {
      or: [
        {
          '==': [
            {
              '%': [
                {
                  var: 'TRANSACTION:originAmountDetails-transactionAmount',
                },
                100,
              ],
            },
            0,
          ],
        },
        {
          '==': [
            {
              '%': [
                {
                  var: 'TRANSACTION:destinationAmountDetails-transactionAmount',
                },
                100,
              ],
            },
            0,
          ],
        },
      ],
    }
    const originRoundFilter = {
      '==': [
        {
          '%': [
            {
              var: 'TRANSACTION:originAmountDetails-transactionAmount',
            },
            100,
          ],
        },
        0,
      ],
    }
    const destinationRoundFilter = {
      '==': [
        {
          '%': [
            {
              var: 'TRANSACTION:destinationAmountDetails-transactionAmount',
            },
            100,
          ],
        },
        0,
      ],
    }

    const logicAggregationVariables: LogicAggregationVariable[] = []

    logicAggregationVariables.push({
      key: 'agg:roundValueTransactionsCount',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: roundfilter,
    })

    if (checkSender !== 'none') {
      logicAggregationVariables.push({
        key: 'agg:sendingRoundValueTransactionsCount',
        type: 'USER_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
        filtersLogic: originRoundFilter,
      })
    }

    if (checkReceiver !== 'none') {
      logicAggregationVariables.push({
        key: 'agg:receivingRoundValueTransactionsCount',
        type: 'USER_TRANSACTIONS',
        userDirection: 'RECEIVER',
        transactionDirection: 'RECEIVING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
        filtersLogic: destinationRoundFilter,
      })
    }

    logicAggregationVariables.push({
      key: 'agg:uniqueRoundValueTransactions',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originAmountDetails-transactionAmount',
      aggregationFunc: 'COUNT',
      aggregationGroupByFieldKey:
        'TRANSACTION:originAmountDetails-transactionAmount',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: originRoundFilter,
    })

    logicAggregationVariables.push({
      key: 'agg:sendingUniqueRoundValuePaymentMethodDetails',
      type: 'PAYMENT_DETAILS_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:originPaymentDetails-method',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: originRoundFilter,
    })
    logicAggregationVariables.push({
      key: 'agg:receivingUniqueRoundValuePaymentMethodDetails',
      type: 'PAYMENT_DETAILS_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:destinationPaymentDetails-method',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: timeWindow,
        end: { units: 0, granularity: 'now' },
      },
      includeCurrentEntity: true,
      filtersLogic: originRoundFilter,
    })

    const baseCurrency = 'USD'
    const conditions: any[] = []

    if (sameAmount) {
      conditions.push({
        '>=': [
          {
            var: 'agg:uniqueRoundValueTransactions',
          },
          transactionsLimit + (initialTransactions || 0) + 1,
        ],
      })
    }

    if (originMatchPaymentMethodDetails) {
      conditions.push({
        '>=': [
          { var: 'agg:sendingUniqueRoundValuePaymentMethodDetails' },
          transactionsLimit + (initialTransactions || 0) + 1,
        ],
      })
    }

    if (destinationMatchPaymentMethodDetails) {
      conditions.push({
        '>=': [
          { var: 'agg:receivingUniqueRoundValuePaymentMethodDetails' },
          transactionsLimit + (initialTransactions || 0) + 1,
        ],
      })
    }

    if (
      !sameAmount &&
      !originMatchPaymentMethodDetails &&
      !destinationMatchPaymentMethodDetails
    ) {
      if (checkSender !== 'none' && checkReceiver !== 'none') {
        conditions.push({
          '>=': [
            { var: 'agg:roundValueTransactionsCount' },
            transactionsLimit + (initialTransactions || 0) + 1,
          ],
        })
      }
      if (checkSender == 'none' && checkReceiver !== 'none') {
        conditions.push({
          '>=': [
            { var: 'agg:receivingRoundValueTransactionsCount' },
            transactionsLimit + (initialTransactions || 0) + 1,
          ],
        })
      }
      if (checkSender !== 'none' && checkReceiver == 'none') {
        conditions.push({
          '>=': [
            { var: 'agg:sendingRoundValueTransactionsCount' },
            transactionsLimit + (initialTransactions || 0) + 1,
          ],
        })
      }
    }

    return {
      logic: { or: conditions },
      logicAggregationVariables,
      baseCurrency,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-94': (parameters: SamePaymentDetailsParameters) => {
    const { timeWindow, threshold, checkSender, checkReceiver } = parameters
    const logicAggregationVariables: LogicAggregationVariable[] = []
    const conditionsToEvaluate: any[] = []

    if (checkSender !== 'none') {
      const senderAggVarConfig: Partial<LogicAggregationVariable> = {
        key: 'agg:senderPaymentIdentifierCount',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
      }

      if (checkSender === 'all') {
        senderAggVarConfig.userDirection = 'SENDER'
        senderAggVarConfig.transactionDirection = 'SENDING_RECEIVING'
        senderAggVarConfig.aggregationFieldKey =
          'TRANSACTION:originPaymentDetailsIdentifier'
        senderAggVarConfig.secondaryAggregationFieldKey =
          'TRANSACTION:destinationPaymentDetailsIdentifier'
        senderAggVarConfig.filtersLogic = {
          or: [
            {
              and: [
                {
                  '!=': [
                    { var: 'TRANSACTION:originPaymentDetailsIdentifier' },
                    null,
                  ],
                },
                {
                  '!=': [
                    { var: 'TRANSACTION:originPaymentDetailsIdentifier' },
                    '',
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '!=': [
                    { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                    null,
                  ],
                },
                {
                  '!=': [
                    { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                    '',
                  ],
                },
              ],
            },
          ],
        }
      } else {
        senderAggVarConfig.userDirection = 'SENDER'
        senderAggVarConfig.transactionDirection = 'SENDING'
        senderAggVarConfig.aggregationFieldKey =
          'TRANSACTION:originPaymentDetailsIdentifier'
        senderAggVarConfig.filtersLogic = {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:originPaymentDetailsIdentifier' },
                null,
              ],
            },
            {
              '!=': [{ var: 'TRANSACTION:originPaymentDetailsIdentifier' }, ''],
            },
          ],
        }
      }
      logicAggregationVariables.push(
        senderAggVarConfig as LogicAggregationVariable
      )

      conditionsToEvaluate.push({
        and: [
          { '>=': [{ var: 'agg:senderPaymentIdentifierCount' }, threshold] },
          {
            '!=': [{ var: 'TRANSACTION:originPaymentDetailsIdentifier' }, null],
          },
          { '!=': [{ var: 'TRANSACTION:originPaymentDetailsIdentifier' }, ''] },
        ],
      })
    }

    if (checkReceiver !== 'none') {
      const receiverAggVarConfig: Partial<LogicAggregationVariable> = {
        key: 'agg:receiverPaymentIdentifierCount',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: timeWindow,
          end: { units: 0, granularity: 'now' },
        },
        includeCurrentEntity: true,
      }

      if (checkReceiver === 'all') {
        receiverAggVarConfig.userDirection = 'RECEIVER'
        receiverAggVarConfig.transactionDirection = 'SENDING_RECEIVING'
        receiverAggVarConfig.aggregationFieldKey =
          'TRANSACTION:originPaymentDetailsIdentifier'
        receiverAggVarConfig.secondaryAggregationFieldKey =
          'TRANSACTION:destinationPaymentDetailsIdentifier'
        receiverAggVarConfig.filtersLogic = {
          or: [
            {
              and: [
                {
                  '!=': [
                    { var: 'TRANSACTION:originPaymentDetailsIdentifier' },
                    null,
                  ],
                },
                {
                  '!=': [
                    { var: 'TRANSACTION:originPaymentDetailsIdentifier' },
                    '',
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '!=': [
                    { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                    null,
                  ],
                },
                {
                  '!=': [
                    { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                    '',
                  ],
                },
              ],
            },
          ],
        }
      } else {
        // 'receiving'
        receiverAggVarConfig.userDirection = 'RECEIVER'
        receiverAggVarConfig.transactionDirection = 'RECEIVING'
        receiverAggVarConfig.aggregationFieldKey =
          'TRANSACTION:destinationPaymentDetailsIdentifier'
        receiverAggVarConfig.filtersLogic = {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                null,
              ],
            },
            {
              '!=': [
                { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
                '',
              ],
            },
          ],
        }
      }
      logicAggregationVariables.push(
        receiverAggVarConfig as LogicAggregationVariable
      )

      conditionsToEvaluate.push({
        and: [
          { '>=': [{ var: 'agg:receiverPaymentIdentifierCount' }, threshold] },
          {
            '!=': [
              { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
              null,
            ],
          },
          {
            '!=': [
              { var: 'TRANSACTION:destinationPaymentDetailsIdentifier' },
              '',
            ],
          },
        ],
      })
    }

    let finalLogic
    if (conditionsToEvaluate.length === 0) {
      finalLogic = { and: [false] } // No conditions, rule should not hit
    } else if (conditionsToEvaluate.length === 1) {
      finalLogic = conditionsToEvaluate[0]
    } else {
      finalLogic = { or: conditionsToEvaluate }
    }

    return {
      logic: finalLogic,
      logicAggregationVariables,
      alertCreationDirection: 'AUTO',
    }
  },
  'R-118': (parameters: PaymentMethodNameRuleParameter) => {
    const { allowedDistancePercentage, ignoreEmptyName } = parameters
    const orBlocks: any[] = []

    if (!ignoreEmptyName) {
      const senderUserNamePresent = {
        or: [
          { '!!': { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' } },
          {
            '!!': {
              var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER',
            },
          },
        ],
      }
      const receiverUserNamePresent = {
        or: [
          {
            '!!': { var: 'CONSUMER_USER:userDetails-name-firstName__RECEIVER' },
          },
          {
            '!!': {
              var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__RECEIVER',
            },
          },
        ],
      }
      const originPaymentMethodCardNamePresent = {
        or: [
          {
            '!=': [
              { var: 'TRANSACTION:originPaymentDetails-nameOnCard-firstName' },
              '',
            ],
          },
          {
            '!=': [
              { var: 'TRANSACTION:originPaymentDetails-nameOnCard-lastName' },
              '',
            ],
          },
        ],
      }
      const originPaymentMethodNonCardNamePresent = {
        '!=': [{ var: 'TRANSACTION:originPaymentDetails-name' }, ''],
      }
      const destinationPaymentMethodCardNamePresent = {
        or: [
          {
            '!=': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-firstName',
              },
              '',
            ],
          },
          {
            '!=': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-lastName',
              },
              '',
            ],
          },
        ],
      }
      const destinationPaymentMethodNonCardNamePresent = {
        '!=': [{ var: 'TRANSACTION:destinationPaymentDetails-name' }, ''],
      }

      // Constants for Levenshtein distance checks
      const senderConsumerName = {
        concat_string: [
          { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' },
          { var: 'CONSUMER_USER:userDetails-name-lastName__SENDER' },
        ],
      }
      const senderBusinessName = {
        var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER',
      }
      const receiverConsumerName = {
        concat_string: [
          { var: 'CONSUMER_USER:userDetails-name-firstName__RECEIVER' },
          { var: 'CONSUMER_USER:userDetails-name-lastName__RECEIVER' },
        ],
      }
      const receiverBusinessName = {
        var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__RECEIVER',
      }
      const originCardName = {
        concat_string: [
          { var: 'TRANSACTION:originPaymentDetails-nameOnCard-firstName' },
          { var: 'TRANSACTION:originPaymentDetails-nameOnCard-lastName' },
        ],
      }
      const originNonCardName = { var: 'TRANSACTION:originPaymentDetails-name' }
      const destinationCardName = {
        concat_string: [
          {
            var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-firstName',
          },
          {
            var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-lastName',
          },
        ],
      }
      const destinationNonCardName = {
        var: 'TRANSACTION:destinationPaymentDetails-name',
      }

      const createLevenshteinCondition = (
        userExistsVar: object,
        userNameVar: object,
        paymentMethodIsCard: boolean,
        paymentNameIsPresent: object,
        paymentNameVar: object,
        direction: 'origin' | 'destination'
      ) => ({
        and: [
          userExistsVar,
          {
            [paymentMethodIsCard ? '==' : '!=']: [
              { var: `TRANSACTION:${direction}PaymentDetails-method` },
              'CARD',
            ],
          },
          paymentNameIsPresent,
          {
            'op:internalLevenshteinDistance': [
              userNameVar,
              paymentNameVar,
              [allowedDistancePercentage],
            ],
          },
        ],
      })

      orBlocks.push(
        // XOR conditions: User name present, payment name absent (CARD)
        {
          and: [
            {
              '==': [
                { var: 'TRANSACTION:originPaymentDetails-method' },
                'CARD',
              ],
            },
            senderUserNamePresent,
            { '!': originPaymentMethodCardNamePresent },
          ],
        },
        // XOR conditions: User name present, payment name absent (non-CARD)
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:originPaymentDetails-method' },
                'CARD',
              ],
            },
            senderUserNamePresent,
            { '!': originPaymentMethodNonCardNamePresent },
          ],
        },
        // XOR conditions: User name absent, payment name present (CARD)
        {
          and: [
            {
              '==': [
                { var: 'TRANSACTION:originPaymentDetails-method' },
                'CARD',
              ],
            },
            { '!': senderUserNamePresent },
            originPaymentMethodCardNamePresent,
          ],
        },
        // XOR conditions: User name absent, payment name present (non-CARD)
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:originPaymentDetails-method' },
                'CARD',
              ],
            },
            { '!': senderUserNamePresent },
            originPaymentMethodNonCardNamePresent,
          ],
        },
        // XOR conditions: Receiver - User name present, payment name absent (CARD)
        {
          and: [
            {
              '==': [
                { var: 'TRANSACTION:destinationPaymentDetails-method' },
                'CARD',
              ],
            },
            receiverUserNamePresent,
            { '!': destinationPaymentMethodCardNamePresent },
          ],
        },
        // XOR conditions: Receiver - User name present, payment name absent (non-CARD)
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:destinationPaymentDetails-method' },
                'CARD',
              ],
            },
            receiverUserNamePresent,
            { '!': destinationPaymentMethodNonCardNamePresent },
          ],
        },
        // XOR conditions: Receiver - User name absent, payment name present (CARD)
        {
          and: [
            {
              '==': [
                { var: 'TRANSACTION:destinationPaymentDetails-method' },
                'CARD',
              ],
            },
            { '!': receiverUserNamePresent },
            destinationPaymentMethodCardNamePresent,
          ],
        },
        // XOR conditions: Receiver - User name absent, payment name present (non-CARD)
        {
          and: [
            {
              '!=': [
                { var: 'TRANSACTION:destinationPaymentDetails-method' },
                'CARD',
              ],
            },
            { '!': receiverUserNamePresent },
            destinationPaymentMethodNonCardNamePresent,
          ],
        },
        // Levenshtein conditions: SENDER
        createLevenshteinCondition(
          { '!!': senderConsumerName.concat_string[0] },
          senderConsumerName,
          true,
          { '!=': [originCardName, ''] },
          originCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderConsumerName.concat_string[0] },
          senderConsumerName,
          false,
          { '!=': [originNonCardName, ''] },
          originNonCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderBusinessName },
          senderBusinessName,
          true,
          { '!=': [originCardName, ''] },
          originCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderBusinessName },
          senderBusinessName,
          false,
          { '!=': [originNonCardName, ''] },
          originNonCardName,
          'origin'
        ),
        // Levenshtein conditions: RECEIVER
        createLevenshteinCondition(
          { '!!': receiverConsumerName.concat_string[0] },
          receiverConsumerName,
          true,
          { '!=': [destinationCardName, ''] },
          destinationCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverConsumerName.concat_string[0] },
          receiverConsumerName,
          false,
          { '!=': [destinationNonCardName, ''] },
          destinationNonCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverBusinessName },
          receiverBusinessName,
          true,
          { '!=': [destinationCardName, ''] },
          destinationCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverBusinessName },
          receiverBusinessName,
          false,
          { '!=': [destinationNonCardName, ''] },
          destinationNonCardName,
          'destination'
        )
      )
    } else {
      const senderConsumerName = {
        concat_string: [
          { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' },
          { var: 'CONSUMER_USER:userDetails-name-lastName__SENDER' },
        ],
      }
      const senderBusinessName = {
        var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER',
      }
      const receiverConsumerName = {
        concat_string: [
          { var: 'CONSUMER_USER:userDetails-name-firstName__RECEIVER' },
          { var: 'CONSUMER_USER:userDetails-name-lastName__RECEIVER' },
        ],
      }
      const receiverBusinessName = {
        var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__RECEIVER',
      }

      const originCardName = {
        concat_string: [
          { var: 'TRANSACTION:originPaymentDetails-nameOnCard-firstName' },
          { var: 'TRANSACTION:originPaymentDetails-nameOnCard-lastName' },
        ],
      }
      const originNonCardName = { var: 'TRANSACTION:originPaymentDetails-name' }
      const destinationCardName = {
        concat_string: [
          {
            var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-firstName',
          },
          {
            var: 'TRANSACTION:destinationPaymentDetails-nameOnCard-lastName',
          },
        ],
      }
      const destinationNonCardName = {
        var: 'TRANSACTION:destinationPaymentDetails-name',
      }

      const createLevenshteinCondition = (
        userExistsVar: object,
        userNameVar: object,
        paymentMethodIsCard: boolean,
        paymentNameIsPresent: object,
        paymentNameVar: object,
        direction: 'origin' | 'destination'
      ) => ({
        and: [
          userExistsVar,
          {
            [paymentMethodIsCard ? '==' : '!=']: [
              { var: `TRANSACTION:${direction}PaymentDetails-method` },
              'CARD',
            ],
          },
          paymentNameIsPresent,
          {
            'op:internalLevenshteinDistance': [
              userNameVar,
              paymentNameVar,
              [allowedDistancePercentage],
            ],
          },
        ],
      })

      orBlocks.push(
        // SENDER
        createLevenshteinCondition(
          { '!!': senderConsumerName.concat_string[0] },
          senderConsumerName,
          true,
          { '!=': [originCardName, ''] },
          originCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderConsumerName.concat_string[0] },
          senderConsumerName,
          false,
          { '!=': [originNonCardName, ''] },
          originNonCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderBusinessName },
          senderBusinessName,
          true,
          { '!=': [originCardName, ''] },
          originCardName,
          'origin'
        ),
        createLevenshteinCondition(
          { '!!': senderBusinessName },
          senderBusinessName,
          false,
          { '!=': [originNonCardName, ''] },
          originNonCardName,
          'origin'
        ),
        // RECEIVER
        createLevenshteinCondition(
          { '!!': receiverConsumerName.concat_string[0] },
          receiverConsumerName,
          true,
          { '!=': [destinationCardName, ''] },
          destinationCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverConsumerName.concat_string[0] },
          receiverConsumerName,
          false,
          { '!=': [destinationNonCardName, ''] },
          destinationNonCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverBusinessName },
          receiverBusinessName,
          true,
          { '!=': [destinationCardName, ''] },
          destinationCardName,
          'destination'
        ),
        createLevenshteinCondition(
          { '!!': receiverBusinessName },
          receiverBusinessName,
          false,
          { '!=': [destinationNonCardName, ''] },
          destinationNonCardName,
          'destination'
        )
      )
    }

    return {
      logic: { or: orBlocks },
      logicAggregationVariables: [],
      alertCreationDirection: 'AUTO',
    }
  },
}

export const V8_MIGRATED_RULES = Object.keys(V8_CONVERSION)
