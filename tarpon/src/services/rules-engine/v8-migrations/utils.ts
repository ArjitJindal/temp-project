import { LegacyFilters, TransactionHistoricalFilters } from '../filters'
import {
  TimeWindow,
  TransactionTimeRange,
} from '../utils/rule-parameter-schemas'
import { PaymentRuleFiltersChildParameters } from '../transaction-filters/payment-filters-base'
import { RuleAggregationFunc } from '@/@types/openapi-internal/RuleAggregationFunc'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

const getUnit = (granularity: string | undefined) => {
  return granularity === 'day'
    ? 'Days'
    : granularity === 'month'
    ? 'Months'
    : 'Years'
}

export function migrateCheckDirectionParameters(
  type: 'COUNT' | 'AMOUNT',
  parameters: {
    timeWindow: TimeWindow
    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'
    originMatchPaymentMethodDetails?: boolean
    destinationMatchPaymentMethodDetails?: boolean
  }
): {
  logicAggregationVariables: RuleAggregationVariable[]
  alertCreationDirection: AlertCreationDirection
} {
  let aggregationFunc: RuleAggregationFunc
  if (type === 'COUNT') {
    aggregationFunc = 'COUNT'
  } else if (type === 'AMOUNT') {
    aggregationFunc = 'SUM'
  } else {
    throw new Error('Invalid type')
  }
  let aggregationFieldKey: string = ''
  if (type === 'COUNT') {
    aggregationFieldKey = 'TRANSACTION:transactionId'
  }

  const logicAggregationVariables: RuleAggregationVariable[] = []
  if (parameters.checkSender === 'sending') {
    if (type === 'AMOUNT') {
      aggregationFieldKey = 'TRANSACTION:originAmountDetails-transactionAmount'
    }
    logicAggregationVariables.push({
      key: 'agg:sending',
      type: parameters.originMatchPaymentMethodDetails
        ? 'PAYMENT_DETAILS_TRANSACTIONS'
        : 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  if (parameters.checkReceiver === 'receiving') {
    if (type === 'AMOUNT') {
      aggregationFieldKey =
        'TRANSACTION:destinationAmountDetails-transactionAmount'
    }
    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: parameters.destinationMatchPaymentMethodDetails
        ? 'PAYMENT_DETAILS_TRANSACTIONS'
        : 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  if (
    !parameters.checkSender ||
    parameters.checkSender === 'all' ||
    !parameters.checkReceiver ||
    parameters.checkReceiver === 'all'
  ) {
    let secondaryAggregationFieldKey = 'TRANSACTION:transactionId'
    if (type === 'AMOUNT') {
      if (parameters.checkSender) {
        aggregationFieldKey =
          'TRANSACTION:originAmountDetails-transactionAmount'
        secondaryAggregationFieldKey =
          'TRANSACTION:destinationAmountDetails-transactionAmount'
      } else {
        aggregationFieldKey =
          'TRANSACTION:destinationAmountDetails-transactionAmount'
        secondaryAggregationFieldKey =
          'TRANSACTION:originAmountDetails-transactionAmount'
      }
    }
    logicAggregationVariables.push({
      key: 'agg:sending-receiving',
      type:
        parameters.originMatchPaymentMethodDetails ||
        parameters.destinationMatchPaymentMethodDetails
          ? 'PAYMENT_DETAILS_TRANSACTIONS'
          : 'USER_TRANSACTIONS',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey,
      secondaryAggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  let alertCreationDirection: AlertCreationDirection = 'AUTO'
  if (parameters.checkSender !== 'none' && parameters.checkReceiver == 'none') {
    alertCreationDirection = 'AUTO_ORIGIN'
  } else if (
    parameters.checkReceiver !== 'none' &&
    parameters.checkSender == 'none'
  ) {
    alertCreationDirection = 'AUTO_DESTINATION'
  }

  return {
    logicAggregationVariables,
    alertCreationDirection,
  }
}

export function getFiltersConditions(filters: LegacyFilters): {
  filterConditions: any[]
  baseCurrency?: string
  alertCreationDirection: AlertCreationDirection | undefined
} {
  const conditions: any[] = []
  if (filters.originPaymentFilters) {
    const originPaymentCondtions = paymentFilters(
      filters.originPaymentFilters,
      'origin'
    )
    conditions.push(...originPaymentCondtions)
  }

  if (filters.destinationPaymentFilters) {
    const destinationPaymentCondtions = paymentFilters(
      filters.destinationPaymentFilters,
      'destination'
    )
    conditions.push(...destinationPaymentCondtions)
  }
  if (filters.transactionTypes && filters.transactionTypes.length > 0) {
    conditions.push({
      in: [
        {
          var: 'TRANSACTION:type',
        },
        filters.transactionTypes,
      ],
    })
  }

  if (
    filters.originTransactionCountries &&
    filters.originTransactionCountries.length > 0
  ) {
    conditions.push(
      transactionCountryFilterConditions(
        'origin',
        filters.originTransactionCountries
      )
    )
  }
  if (
    filters.destinationTransactionCountries &&
    filters.destinationTransactionCountries.length > 0
  ) {
    conditions.push(
      transactionCountryFilterConditions(
        'destination',
        filters.destinationTransactionCountries
      )
    )
  }
  if (filters.transactionAmountRange) {
    const amountCondition: { and: any[] } = { and: [] }
    const { min, max } = Object.values(filters.transactionAmountRange)[0]
    if (min) {
      amountCondition.and.push({
        '>=': [
          { var: 'TRANSACTION:amountDetails-transactionAmount__BOTH' },
          min,
        ],
      })
    }
    if (max) {
      amountCondition.and.push({
        '<': [
          { var: 'TRANSACTION:amountDetails-transactionAmount__BOTH' },
          max,
        ],
      })
    }
    conditions.push(amountCondition)
  }
  if (filters.productTypes && filters.productTypes.length > 0) {
    conditions.push({
      in: [
        {
          var: 'TRANSACTION:productType',
        },
        filters.productTypes,
      ],
    })
  }
  if (filters.transactionStates && filters.transactionStates.length > 0) {
    conditions.push({
      in: [
        {
          var: 'TRANSACTION:transactionState',
        },
        filters.transactionStates,
      ],
    })
  }
  if (filters.transactionTags) {
    const tagFilters = Object.entries(filters.transactionTags)
    if (tagFilters.length > 0) {
      const tagConditions = tagFilters.map(([key, value]) => ({
        some: [
          {
            var: `TRANSACTION:tags`,
          },
          {
            and: [
              {
                '==': [
                  {
                    var: 'key',
                  },
                  key,
                ],
              },
              {
                in: [
                  {
                    var: 'value',
                  },
                  value,
                ],
              },
            ],
          },
        ],
      }))

      conditions.push({
        or: tagConditions,
      })
    }
  }
  if (filters.transactionTimeRange24hr) {
    const timeRange = filters.transactionTimeRange24hr
    conditions.push(transactionTimeRangeFilterConditions(timeRange))
  }

  if (
    filters.userResidenceCountries &&
    filters.userResidenceCountries.length > 0
  ) {
    const residenceConditions: any[] = []
    residenceConditions.push(
      ...[
        {
          some: [
            {
              var: 'BUSINESS_USER:directors__BOTH',
            },
            {
              in: [
                {
                  var: 'generalDetails.countryOfResidence',
                },
                filters.userResidenceCountries,
              ],
            },
          ],
        },
        {
          some: [
            {
              var: 'BUSINESS_USER:shareHolders__BOTH',
            },
            {
              in: [
                {
                  var: 'generalDetails.countryOfResidence',
                },
                filters.userResidenceCountries,
              ],
            },
          ],
        },
        {
          in: [
            {
              var: 'CONSUMER_USER:userDetails-countryOfResidence__BOTH',
            },
            filters.userResidenceCountries,
          ],
        },
      ]
    )
    conditions.push({
      or: residenceConditions,
    })
  }
  if (
    filters.userNationalityCountries &&
    filters.userNationalityCountries.length > 0
  ) {
    const nationalityConditions: any[] = []
    nationalityConditions.push(
      ...[
        {
          some: [
            {
              var: 'BUSINESS_USER:directors__BOTH',
            },
            {
              in: [
                {
                  var: 'generalDetails.countryOfNationality',
                },
                filters.userNationalityCountries,
              ],
            },
          ],
        },
        {
          some: [
            {
              var: 'BUSINESS_USER:shareHolders__BOTH',
            },
            {
              in: [
                {
                  var: 'generalDetails.countryOfNationality',
                },
                filters.userNationalityCountries,
              ],
            },
          ],
        },
        {
          in: [
            {
              var: 'CONSUMER_USER:userDetails-countryOfNationality__BOTH',
            },
            filters.userNationalityCountries,
          ],
        },
      ]
    )
    conditions.push({
      or: nationalityConditions,
    })
  }
  if (
    filters.userRegistrationCountries &&
    filters.userRegistrationCountries.length > 0
  ) {
    conditions.push({
      in: [
        {
          var: 'BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__BOTH',
        },
        filters.userRegistrationCountries,
      ],
    })
  }
  if (filters.userType) {
    conditions.push({
      '==': [
        {
          var: 'USER:type__BOTH',
        },
        filters.userType,
      ],
    })
  }
  if (filters.userAgeRange) {
    const { minAge, maxAge } = filters.userAgeRange
    const minGranularity = minAge?.granularity
    const maxGranularity = maxAge?.granularity
    /* ToDo: Remove the customer type check and use direction less variable after FR-4816 */
    conditions.push({
      or: [
        {
          or: [
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'CONSUMER',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `CONSUMER_USER:age${getUnit(
                            minGranularity
                          )}__SENDER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<': [
                        {
                          var: `CONSUMER_USER:age${getUnit(
                            maxGranularity
                          )}__SENDER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'BUSINESS',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `BUSINESS_USER:age${getUnit(
                            minGranularity
                          )}__SENDER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<': [
                        {
                          var: `BUSINESS_USER:age${getUnit(
                            maxGranularity
                          )}__SENDER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          or: [
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'CONSUMER',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `CONSUMER_USER:age${getUnit(
                            minGranularity
                          )}__RECEIVER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<': [
                        {
                          var: `CONSUMER_USER:age${getUnit(
                            maxGranularity
                          )}__RECEIVER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'BUSINESS',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `BUSINESS_USER:age${getUnit(
                            minGranularity
                          )}__RECEIVER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<': [
                        {
                          var: `BUSINESS_USER:age${getUnit(
                            maxGranularity
                          )}__RECEIVER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  }
  if (filters.userCreationAgeRange) {
    const { minAge, maxAge } = filters.userCreationAgeRange
    const minGranularity = minAge?.granularity
    const maxGranularity = maxAge?.granularity
    /* ToDo: Remove the customer type check and use direction less variable after FR-4816 */
    conditions.push({
      or: [
        {
          or: [
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'CONSUMER',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `CONSUMER_USER:creationAge${getUnit(
                            minGranularity
                          )}__RECEIVER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<=': [
                        {
                          var: `CONSUMER_USER:creationAge${getUnit(
                            maxGranularity
                          )}__RECEIVER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'BUSINESS',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `BUSINESS_USER:creationAge${getUnit(
                            minGranularity
                          )}__RECEIVER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<=': [
                        {
                          var: `BUSINESS_USER:creationAge${getUnit(
                            maxGranularity
                          )}__RECEIVER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          or: [
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'CONSUMER',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `CONSUMER_USER:creationAge${getUnit(
                            minGranularity
                          )}__SENDER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<=': [
                        {
                          var: `CONSUMER_USER:creationAge${getUnit(
                            maxGranularity
                          )}__SENDER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
            {
              and: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'BUSINESS',
                  ],
                },
                {
                  and: [
                    {
                      '>=': [
                        {
                          var: `BUSINESS_USER:creationAge${getUnit(
                            minGranularity
                          )}__SENDER`,
                        },
                        minAge?.units ?? 0,
                      ],
                    },
                    {
                      '<=': [
                        {
                          var: `BUSINESS_USER:creationAge${getUnit(
                            maxGranularity
                          )}__SENDER`,
                        },
                        maxAge?.units ?? Number.MAX_SAFE_INTEGER,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  }
  if (filters.consumerUserSegments && filters.consumerUserSegments.length > 0) {
    conditions.push({
      in: [
        {
          var: 'CONSUMER_USER:userSegment__BOTH',
        },
        filters.consumerUserSegments,
      ],
    })
  }
  if (filters.businessUserSegments && filters.businessUserSegments.length > 0) {
    conditions.push({
      in: [
        {
          var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__BOTH',
        },
        filters.businessUserSegments,
      ],
    })
  }
  if (filters.whitelistUsers) {
    const { listIds, userIds } = filters.whitelistUsers
    if (listIds && listIds.length > 0) {
      conditions.push({
        and: [
          {
            '!': {
              or: [
                {
                  'op:inlist': [
                    {
                      var: 'CONSUMER_USER:userId__BOTH',
                    },
                    listIds,
                  ],
                },
                {
                  'op:inlist': [
                    {
                      var: 'BUSINESS_USER:userId__BOTH',
                    },
                    listIds,
                  ],
                },
              ],
            },
          },
        ],
      })
    }
    if (userIds && userIds.length > 0) {
      conditions.push({
        '!': {
          or: [
            {
              in: [
                {
                  var: 'CONSUMER_USER:userId__BOTH',
                },
                userIds,
              ],
            },
            {
              in: [
                {
                  var: 'BUSINESS_USER:userId__BOTH',
                },
                userIds,
              ],
            },
          ],
        },
      })
    }
  }
  if (filters.userIds && filters.userIds.length > 0) {
    conditions.push({
      or: [
        {
          in: [
            {
              var: 'CONSUMER_USER:userId__BOTH',
            },
            filters.userIds,
          ],
        },
        {
          in: [
            {
              var: 'BUSINESS_USER:userId__BOTH',
            },
            filters.userIds,
          ],
        },
      ],
    })
  }
  if (filters.acquisitionChannels && filters.acquisitionChannels.length > 0) {
    const acquisitionChannelConditions: any[] = []
    acquisitionChannelConditions.push(
      {
        in: [
          {
            var: 'CONSUMER_USER:acquisitionChannel__BOTH',
          },
          filters.acquisitionChannels,
        ],
      },
      {
        in: [
          {
            var: 'BUSINESS_USER:acquisitionChannel__BOTH',
          },
          filters.acquisitionChannels,
        ],
      }
    )
    conditions.push({
      or: acquisitionChannelConditions,
    })
  }
  if (filters.kycStatus && filters.kycStatus.length > 0) {
    const kycStatusConditions: any[] = []
    kycStatusConditions.push(
      {
        in: [
          {
            var: 'CONSUMER_USER:kycStatusDetails-status__BOTH',
          },
          filters.kycStatus,
        ],
      },
      {
        in: [
          {
            var: 'BUSINESS_USER:kycStatusDetails-status__BOTH',
          },
          filters.kycStatus,
        ],
      }
    )
    conditions.push({
      or: kycStatusConditions,
    })
  }

  if (filters.userStatus && filters.userStatus.length > 0) {
    const userStatusConditions: any[] = []
    userStatusConditions.push(
      {
        in: [
          {
            var: 'CONSUMER_USER:userStateDetails-state__BOTH',
          },
          filters.userStatus,
        ],
      },
      {
        in: [
          {
            var: 'BUSINESS_USER:userStateDetails-state__BOTH',
          },
          filters.userStatus,
        ],
      }
    )
    conditions.push({
      or: userStatusConditions,
    })
  }
  if (filters.userTags) {
    const tagFilters = Object.entries(filters.userTags)
    if (tagFilters.length > 0) {
      const consumerTagConditions = tagFilters.map(([key, value]) => ({
        some: [
          {
            var: `CONSUMER_USER:tags__BOTH`,
          },
          {
            and: [
              {
                '==': [
                  {
                    var: 'key',
                  },
                  key,
                ],
              },
              {
                in: [
                  {
                    var: 'value',
                  },
                  value,
                ],
              },
            ],
          },
        ],
      }))

      const businessTagConditions = tagFilters.map(([key, value]) => ({
        some: [
          {
            var: `BUSINESS_USER:tags__BOTH`,
          },
          {
            and: [
              {
                '==': [
                  {
                    var: 'key',
                  },
                  key,
                ],
              },
              {
                in: [
                  {
                    var: 'value',
                  },
                  value,
                ],
              },
            ],
          },
        ],
      }))
      conditions.push({
        or: [{ and: consumerTagConditions }, { and: businessTagConditions }],
      })
    }
  }
  return {
    filterConditions: conditions,
    baseCurrency: Object.keys(filters?.transactionAmountRange ?? {})[0],
    alertCreationDirection: filters.checkDirection,
  }
}

const paymentFilters = (
  filters: PaymentRuleFiltersChildParameters,
  direction: 'origin' | 'destination'
) => {
  const conditions: any[] = []
  const {
    paymentMethods,
    cardPaymentChannels,
    walletType,
    cardIssuedCountries,
    mccCodes,
  } = filters
  if (paymentMethods && paymentMethods.length > 0) {
    const methodConditions: any[] = []

    const nonCardOrWalletPaymentMethods = paymentMethods.filter(
      (method) => method !== 'CARD' && method !== 'WALLET'
    )
    if (nonCardOrWalletPaymentMethods.length !== 0) {
      const condition: any = {
        in: [
          {
            var: `TRANSACTION:${direction}PaymentDetails-method`,
          },
          nonCardOrWalletPaymentMethods,
        ],
      }
      methodConditions.push(condition)
    }
    if (paymentMethods.includes('CARD')) {
      const condition: any = [
        {
          '==': [
            {
              var: `TRANSACTION:${direction}PaymentDetails-method`,
            },
            'CARD',
          ],
        },
      ]

      if (cardPaymentChannels && cardPaymentChannels.length > 0) {
        condition.push({
          in: [
            {
              var: `TRANSACTION:${direction}PaymentDetails-paymentChannel`,
            },
            cardPaymentChannels,
          ],
        })
      }
      if (cardIssuedCountries && cardIssuedCountries.length > 0) {
        condition.push({
          in: [
            {
              var: `TRANSACTION:${direction}PaymentDetails-cardIssuedCountry`,
            },
            cardIssuedCountries,
          ],
        })
      }
      if (mccCodes && mccCodes.length > 0) {
        condition.push({
          in: [
            {
              var: `TRANSACTION:${direction}PaymentDetails-merchantDetails-MCC`,
            },
            mccCodes,
          ],
        })
      }
      methodConditions.push({ and: condition })
    }
    if (paymentMethods.includes('WALLET')) {
      const condition: any = [
        {
          '==': [
            {
              var: `TRANSACTION:${direction}PaymentDetails-method`,
            },
            'WALLET',
          ],
        },
      ]
      if (walletType) {
        condition.push({
          '==': [
            {
              var: `TRANSACTION:${direction}PaymentDetails-walletType`,
            },
            walletType,
          ],
        })
      }
      methodConditions.push({ and: condition })
    }

    conditions.push({
      or: methodConditions,
    })
  }
  return conditions
}

const transactionCountryFilterConditions = (
  direction: 'origin' | 'destination',
  countries: string[]
) => {
  return {
    in: [
      {
        var: `TRANSACTION:${direction}AmountDetails-country`,
      },
      countries,
    ],
  }
}

const transactionTimeRangeFilterConditions = (
  timeRange: TransactionTimeRange
) => {
  return {
    'op:between_time': [
      {
        var: 'TRANSACTION:time',
      },
      timeRange.startTime.utcHours * 3600 + timeRange.startTime.utcMinutes * 60,
      timeRange.endTime.utcHours * 3600 + timeRange.endTime.utcMinutes * 60,
    ],
  }
}

export const getHistoricalFilterConditions = (
  filters: TransactionHistoricalFilters
) => {
  const conditions: any[] = []
  if (filters.transactionTimeRangeHistorical24hr) {
    const timeRange = filters.transactionTimeRangeHistorical24hr
    conditions.push(transactionTimeRangeFilterConditions(timeRange))
  }
  if (filters.paymentMethodsHistorical) {
    const paymentMethodHistoricalConditions = paymentFilters(
      { paymentMethods: filters.paymentMethodsHistorical },
      'origin'
    )
    paymentMethodHistoricalConditions.push(
      ...paymentFilters(
        { paymentMethods: filters.paymentMethodsHistorical },
        'destination'
      )
    )
    conditions.push({ or: paymentMethodHistoricalConditions })
  }
  if (filters.transactionAmountRangeHistorical) {
    const amountCondition: { and: any[] } = { and: [] }
    const { min, max } = Object.values(
      filters.transactionAmountRangeHistorical
    )[0]
    if (min) {
      amountCondition.and.push({
        '>=': [
          { var: 'TRANSACTION:amountDetails-transactionAmount__BOTH' },
          min,
        ],
      })
    }
    if (max) {
      amountCondition.and.push({
        '<': [
          { var: 'TRANSACTION:amountDetails-transactionAmount__BOTH' },
          max,
        ],
      })
    }
    conditions.push(amountCondition)
  }

  if (
    filters.transactionTypesHistorical &&
    filters.transactionTypesHistorical.length > 0
  ) {
    conditions.push({
      in: [
        {
          var: 'TRANSACTION:type',
        },
        filters.transactionTypesHistorical,
      ],
    })
  }
  if (
    filters.transactionStatesHistorical &&
    filters.transactionStatesHistorical.length > 0
  ) {
    conditions.push({
      in: [
        {
          var: 'TRANSACTION:transactionState',
        },
        filters.transactionStatesHistorical,
      ],
    })
  }
  if (filters.transactionCountriesHistorical) {
    conditions.push({
      or: [
        transactionCountryFilterConditions(
          'origin',
          filters.transactionCountriesHistorical
        ),
        transactionCountryFilterConditions(
          'destination',
          filters.transactionCountriesHistorical
        ),
      ],
    })
  }
  return {
    conditions: conditions,
    baseCurrency: Object.keys(
      filters?.transactionAmountRangeHistorical ?? {}
    )[0],
  }
}
