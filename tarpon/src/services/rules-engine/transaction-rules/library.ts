/**
 * This file is the source of truth of all our rules.
 * We'll deploy the rules defined here automatically during the deployment process.
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1xAl3cqF6cGMyFTpiIOXguyq7P_EGlTldbOWCYj0lMA8
 */

import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { OriginPaymentRuleFiltersParameters } from '../transaction-filters/payment-filters-base'
import { TransactionFilters, UserFilters } from '../filters'
import {
  USER_ONGOING_SCREENING_RULES,
  USER_RULES,
  UserOngoingScreeningRuleImplementationName,
  UserRuleImplementationName,
} from '../user-rules'
import { SanctionsBusinessUserRuleParameters } from '../user-rules/sanctions-business-user'
import { SanctionsBankUserRuleParameters } from '../user-rules/sanctions-bank-name'
import { SanctionsConsumerUserRuleParameters } from '../user-rules/sanctions-consumer-user'
import { UserAddressChangeRuleParameters } from '../user-rules/user-address-change'
import { getMigratedV8Config } from '../v8-migrations'
import { UserOnboardedFromHighRiskCountryRuleParameters } from '../user-rules/user-onboarded-from-high-risk-country'
import { UserInactivityRuleParameters } from '../user-ongoing-rules/user-inactivity'
import { TransactionAmountRuleParameters } from './transaction-amount'
import { TransactionNewCountryRuleParameters } from './transaction-new-country'
import { TransactionNewCurrencyRuleParameters } from './transaction-new-currency'
import { FirstActivityAfterLongTimeRuleParameters } from './first-activity-after-time-period'
import { HighRiskCurrencyRuleParameters } from './high-risk-currency'
import { LowValueTransactionsRuleParameters } from './low-value-transactions-base'
import { MultipleSendersWithinTimePeriodRuleParameters } from './multiple-senders-within-time-period-base'
import { MerchantReceiverNameRuleParameters } from './merchant-receiver-name'
import { BlacklistCardIssuedCountryRuleParameters } from './blacklist-card-issued-country'
import { TransactionReferenceKeywordRuleParameters } from './transaction-reference-keyword'
import { TransactionsVelocityRuleParameters } from './transactions-velocity'
import { IpAddressMultipleUsersRuleParameters } from './ip-address-multiple-users'
import { TooManyUsersForSamePaymentIdentifierParameters } from './too-many-users-for-same-payment-identifier'
import { TransactionsVolumeRuleParameters } from './transactions-volume'
import { SenderLocationChangesFrequencyRuleParameters } from './sender-location-changes-frequency'
import { CardIssuedCountryRuleParameters } from './card-issued-country'
import { TransactionMatchesPatternRuleParameters } from './transaction-amount-pattern'
import { PaymentMethodNameRuleParameter } from './payment-method-name-levensthein-distance'
import { HighTrafficBetweenSamePartiesParameters } from './high-traffic-between-same-parties'
import { HighTrafficVolumeBetweenSameUsersParameters } from './high-traffic-volume-between-same-users'
import { TransactionsRoundValuePercentageRuleParameters } from './transactions-round-value-percentage'
import { TooManyTransactionsToHighRiskCountryRuleParameters } from './too-many-transactions-to-high-risk-country'
import { TooManyCounterpartyCountryRuleParameters } from './too-many-counterparty-country'
import { TransactionsRoundValueVelocityRuleParameters } from './transactions-round-value-velocity'
import { BlacklistPaymentdetailsRuleParameters } from './blacklist-payment-details'
import { TransactionsExceedPastPeriodRuleParameters } from './transactions-exceed-past-period'
import { TransactionsOutflowInflowVolumeRuleParameters } from './transactions-outflow-inflow-volume'
import { SanctionsCounterPartyRuleParameters } from './sanctions-counterparty'
import { TransactionVolumeExceedsTwoPeriodsRuleParameters } from './total-transactions-volume-exceeds'
import { HighRiskCountryRuleParameters } from './high-risk-countries'
import { UsingTooManyBanksToMakePaymentsRuleParameters } from './using-too-many-banks-to-make-payments'
import { HighRiskIpAddressCountriesParameters } from './high-risk-ip-address-countries'
import { TransactionRiskScoreRuleParameters } from './transaction-risk-score'
import { SameUserUsingTooManyPaymentIdentifiersParameters } from './same-user-using-too-many-payment-identifiers'
import { PaymentDetailChangeRuleParameters } from './payment-detail-change-base'
import { TRANSACTION_RULES, TransactionRuleImplementationName } from './index'
import { Rule } from '@/@types/openapi-internal/Rule'
import { HighUnsuccessfullStateRateParameters } from '@/services/rules-engine/transaction-rules/high-unsuccessfull-state-rate'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-daily-amount-exceeded'
import { TransactionsAverageNumberExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-number-exceeded'
import { SamePaymentDetailsParameters } from '@/services/rules-engine/transaction-rules/same-payment-details'
import { BlacklistTransactionMatchedFieldRuleParameters } from '@/services/rules-engine/transaction-rules/blacklist-transaction-related-value'
import { MerchantMonitoringIndustryUserRuleParameters } from '@/services/rules-engine/user-rules/merchant-monitoring-industry'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'

export enum RuleChecksForField {
  FirstTransaction = '1st transaction',
  TransactionAmount = 'Transaction amount',
  NumberOfTransactions = 'No. of transactions',
  UserAccountStatus = 'User account status',
  Time = 'Time',
  TransactionCurrency = 'Transaction currency',
  NumberOfUsers = 'No. of users',
  TransactionCountry = 'Transaction country',
  TransactionPaymentMethodCount = 'Transaction payment method count',
  TransactionPaymentMethodIssuedCountry = 'Transaction payment method issued country',
  UsersIPAddress = "User's IP address",
  TransactionPaymentIdentifier = 'Transaction payment identifier',
  UserCardFingerprintID = 'User card fingerprint ID',
  UserPaymentIdentifier = 'User payment identifier',
  TransactionRiskScore = 'Transaction risk score',
  Username = 'Username',
  BothPartiesUsername = 'Both parties username',
  TransactionState = 'Transaction state',
  CounterpartyCountryCount = 'Counterparty country count',
  TransactionPaymentDetails = 'Transaction payment details',
  UserDetails = 'User details',
  TransactionType = 'Transaction type',
  EntityName = 'Entity name',
  UsersBankName = 'User’s bank name',
  CounterpartyUsername = 'Counterparty username',
  CounterpartyBankName = 'Counterparty bank name',
  UsersYearOfBirth = 'User’s Y.O.B',
  UsersIndustry = 'User’s industry',
  UsersAddress = 'User’s address',
  TransactionDetails = 'Transaction details',
  Keywords = 'Keywords',
  accountHolderName = 'Account holder name',
}

export enum RuleTypeField {
  NewActivity = 'New activity',
  AnomalyDetection = 'Anomaly detection',
  RiskExposure = 'Risk exposure',
  Diversity = 'Diversity',
  PatternRecognition = 'Pattern recognition',
  Velocity = 'Velocity',
  TransactionDenstiy = 'Transaction density',
  VelocityComparison = 'Velocity comparison',
  Volume = 'Volume',
  VolumeComparison = 'Volume comparison',
  Blacklist = 'Blacklist',
  MerchantMonitoring = 'Merchant monitoring',
  Screening = 'Screening',
}

export enum RuleNature {
  AML = 'AML',
  FRAUD = 'FRAUD',
  SCREENING = 'SCREENING',
}

export enum RuleTypology {
  UnusualBehaviour = 'Unusual behaviour',
  MoneyMules = 'Money mules',
  AccountTakeoverFraud = 'Account takeover fraud',
  AcquiringFraud = 'Acquiring fraud',
  IssuingFraud = 'Issuing fraud',
  CardFraud = 'Card fraud',
  Structuring = 'Structuring',
  HiddenUnusualRelationships = 'Hidden / unusual relationships',
  Scams = 'Scams (romance, Nigerian Prince, inheritance and etc.)',
  TerroristFinancing = 'Terrorist financing',
  Layering = 'Layering',
  InternalBlacklists = 'Internal blacklists',
  ScreeningHits = 'Screening hits',
  HighRiskTransactions = 'High risk transactions',
}

const _RULES_LIBRARY: Array<
  () => Omit<
    Rule,
    | 'parametersSchema'
    | 'ruleImplementationName'
    | 'checksFor'
    | 'types'
    | 'defaultNature'
  > & {
    ruleImplementationName:
      | TransactionRuleImplementationName
      | UserRuleImplementationName
      | UserOngoingScreeningRuleImplementationName
    checksFor: RuleChecksForField[]
    types: RuleTypeField[]
    defaultNature: RuleNature
  }
> = [
  () => ({
    id: 'R-1',
    type: 'TRANSACTION',
    name: 'First transaction of a user',
    description: 'First transaction of a user',
    descriptionTemplate:
      "{{ if-sender 'Sender’s' 'Receiver’s' }} first transaction",
    defaultParameters: {},
    defaultAction: 'FLAG',
    ruleImplementationName: 'first-payment',
    labels: [],
    checksFor: [RuleChecksForField.FirstTransaction],
    defaultNature: RuleNature.AML,
    defaultCasePriority: 'P1',
    ruleTypology: 'Account activity, inconsistent with customer profile',
    types: [RuleTypeField.NewActivity],
    typologies: [RuleTypology.UnusualBehaviour],
    sampleUseCases:
      'A new user, opens a bank account and soon after initiates a large international wire transfer.',
  }),
  () => {
    const defaultParameters: TransactionAmountRuleParameters = {
      transactionAmountThreshold: {
        [DEFAULT_CURRENCY_KEYWORD]: 10000,
      },
    }
    return {
      id: 'R-2',
      type: 'TRANSACTION',
      name: 'Transaction amount too high',
      description: `Transaction amount is >= x in ${DEFAULT_CURRENCY_KEYWORD} or equivalent`,
      descriptionTemplate:
        'Transaction amount is {{ format-money limit currency }} or more',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'transaction-amount',
      labels: [],
      checksFor: [RuleChecksForField.TransactionAmount],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.PatternRecognition],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user, usually transacting under 500 SGD, initiates a sudden 10,000 SGD transaction, prompting a review for unusual high-value activity.',
    }
  },
  () => {
    const defaultParameters: TransactionNewCountryRuleParameters = {
      initialTransactions: 10,
    }
    return {
      id: 'R-3',
      type: 'TRANSACTION',
      name: 'Transaction to or from a new country',
      description:
        "Transactions to or from a new country. Trigger the rule after 'x' transactions have been completed. This is relevant when moving between countries.",
      descriptionTemplate:
        "User tried to {{ if-sender 'send' 'receive' }} money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.amount.country }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.payment.country }} prior",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transaction-new-country',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionCountry,
        RuleChecksForField.NumberOfTransactions,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.NewActivity],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user typically transacts domestically, then suddenly starts sending high-value transactions abroad.',
    }
  },
  () => {
    const defaultParameters: TransactionNewCurrencyRuleParameters = {
      initialTransactions: 10,
    }
    return {
      id: 'R-4',
      type: 'TRANSACTION',
      name: 'Transaction including a new currency',
      description:
        "Transactions to or from a new currency. Trigger the rule after 'x' transactions have been completed. This is relevant when moving between countries.",
      descriptionTemplate:
        "User tried to {{ if-sender 'send' 'receive' }} money in {{ hitParty.amount.currency }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money in {{ hitParty.amount.currency }} prior",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transaction-new-currency',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionCurrency,
        RuleChecksForField.NumberOfTransactions,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.NewActivity],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'An account mainly using USD suddenly transacts in EUR. This significant shift triggers an alert for potential scrutiny.',
    }
  },
  () => {
    const defaultParameters: FirstActivityAfterLongTimeRuleParameters = {
      dormancyPeriodDays: 360,
      checkDirection: 'all',
    }
    return {
      id: 'R-5',
      type: 'TRANSACTION',
      name: 'Dormant account',
      description:
        "If a user has made a transaction after being inactive for time 't'",
      descriptionTemplate:
        'User made a transaction from an account which was dormant for {{ parameters.dormancyPeriodDays }} days',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'first-activity-after-time-period',
      labels: [],
      checksFor: [
        RuleChecksForField.UserAccountStatus,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.MoneyMules, RuleTypology.UnusualBehaviour],
      sampleUseCases:
        "An account shows no activity for six months (time 't'), then suddenly executes a high-value transaction.",
    }
  },
  () => {
    const defaultParameters: HighRiskCurrencyRuleParameters = {
      highRiskCurrencies: ['AFN', 'BYN', 'KPW', 'LYD', 'RUB', 'SYP'],
    }
    return {
      id: 'R-6',
      type: 'TRANSACTION',
      name: 'Transaction including a high risk currency',
      description:
        'Transactions including high-risk currencies, often involved in fund transfers b/w currencies, use a customizable list',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} currency ({{ hitParty.amount.currency }}) is a High Risk",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-risk-currency',
      labels: [],
      checksFor: [RuleChecksForField.TransactionCurrency],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.RiskExposure],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user frequently transacts with a high-risk currency linked to money laundering, necessitating closer scrutiny.',
    }
  },
  () => {
    const defaultParameters: LowValueTransactionsRuleParameters = {
      lowTransactionValues: {
        [DEFAULT_CURRENCY_KEYWORD]: {
          max: 1000,
          min: 990,
        },
      },
      lowTransactionCount: 3,
    }
    return {
      id: 'R-7',
      type: 'TRANSACTION',
      name: 'Too many transactions under reporting limit received by a user',
      description:
        '>= ‘x’ number of consecutive low value incoming transactions just below a threshold amount ‘y’ to a user. Often seen in structured money laundering attempts',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'low-value-incoming-transactions',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.NumberOfTransactions,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity, RuleTypeField.TransactionDenstiy],
      typologies: [RuleTypology.Structuring],
      sampleUseCases:
        'Over a week, an individual receive multiple transactions from different recipients, all marginally under the reporting limit, suggesting a deliberate effort to stay under the radar.',
    }
  },
  () => {
    const defaultParameters: LowValueTransactionsRuleParameters = {
      lowTransactionValues: {
        [DEFAULT_CURRENCY_KEYWORD]: {
          max: 1000,
          min: 990,
        },
      },
      lowTransactionCount: 3,
    }
    return {
      id: 'R-8',
      type: 'TRANSACTION',
      name: 'Too many transactions under reporting limit sent by a user',
      description:
        '>= ‘x’ number of consecutive low value outgoing transactions just below a threshold amount ‘y’ to a user. Often seen in structured money laundering attempts',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transaction(s) just under the flagging limit`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'low-value-outgoing-transactions',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.TransactionAmount,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity, RuleTypeField.TransactionDenstiy],
      typologies: [RuleTypology.Structuring, RuleTypology.MoneyMules],
      sampleUseCases:
        'Over a week, an individual sends multiple transactions to different recipients, all marginally under the reporting limit, suggesting a deliberate effort to stay under the radar.',
    }
  },
  () => {
    const defaultParameters: MultipleSendersWithinTimePeriodRuleParameters = {
      timeWindow: {
        units: 30,
        granularity: 'day',
      },
      sendersCount: 4,
    }
    return {
      id: 'R-9',
      type: 'TRANSACTION',
      name: 'Too many users transacting with a single counterparty',
      description:
        'More than ‘x’ users transacting with a single counterparty over a period of time ‘t’ (E.g. Nigerian prince scam outbound)',
      descriptionTemplate:
        'More than {{ parameters.sendersCount }} users transacting with a single counterparty over a set period of {{ format-time-window parameters.timeWindow }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'multiple-user-senders-within-time-period',
      labels: [],
      checksFor: [RuleChecksForField.NumberOfUsers, RuleChecksForField.Time],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [
        RuleTypology.HiddenUnusualRelationships,
        RuleTypology.MoneyMules,
        RuleTypology.Scams,
        RuleTypology.TerroristFinancing,
      ],
      sampleUseCases:
        'Within a week, an unusually large number of different users send money to a single recipient, suggesting a possible scam or money laundering operation.',
    }
  },
  () => {
    const defaultParameters: MultipleSendersWithinTimePeriodRuleParameters = {
      timeWindow: {
        units: 30,
        granularity: 'day',
      },
      sendersCount: 4,
    }
    return {
      id: 'R-10',
      type: 'TRANSACTION',
      name: 'Too many counterparties transacting with a single user',
      description:
        'More than x counterparties transacting with a single user over a period of time t (E.g. Nigerian prince scam inbound)',
      descriptionTemplate:
        'More than {{ parameters.sendersCount }} counterparties transacting with a single user over a set period of {{ format-time-window parameters.timeWindow }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName:
        'multiple-counterparty-senders-within-time-period',
      labels: [],
      checksFor: [RuleChecksForField.NumberOfUsers, RuleChecksForField.Time],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [
        RuleTypology.HiddenUnusualRelationships,
        RuleTypology.MoneyMules,
        RuleTypology.Scams,
        RuleTypology.TerroristFinancing,
      ],
      sampleUseCases:
        'Within a week, an unusually large number of different counterparties send money to a single user, suggesting a possible scam or money laundering operation.',
    }
  },
  () => {
    const defaultParameters: MerchantReceiverNameRuleParameters = {
      merchantNames: [],
    }
    const defaultFilters: TransactionFilters = {
      originPaymentFilters: {
        paymentMethods: ['WALLET'],
      },
    }
    return {
      id: 'R-13',
      type: 'TRANSACTION',
      name: 'Blacklisted receiver’s wallet name',
      description: 'Receiver’s wallet name is blacklisted',
      descriptionTemplate: '{{ receiverName }} is blacklisted',
      defaultParameters,
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'merchant-receiver-name',
      labels: [],
      checksFor: [RuleChecksForField.TransactionPaymentMethodCount],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        'During a transaction, a receiver’s wallet name matches an entry in the blacklist database, triggering an immediate hold on the transaction for further investigation.',
    }
  },
  () => {
    const defaultParameters: HighRiskCountryRuleParameters = {
      highRiskCountries: ['RU', 'SY', 'RO', 'UA'],
    }

    return {
      id: 'R-14',
      type: 'TRANSACTION',
      name: 'High risk country',
      description:
        'Transaction to or from a country that is designated as high risk. This rule uses a customizable list',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} country ({{ hitParty.amount.country }}) is a High Risk",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-risk-countries',
      labels: [],
      checksFor: [RuleChecksForField.TransactionCountry],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.RiskExposure],
      typologies: [
        RuleTypology.HighRiskTransactions,
        RuleTypology.UnusualBehaviour,
      ],
      sampleUseCases:
        'Multiple transactions are initiated to and from a country that has been identified as having high levels of corruption and money laundering.',
    }
  },

  // TODO: Change Rule Description once rule is split into two
  () => {
    const defaultParameters: UsingTooManyBanksToMakePaymentsRuleParameters = {
      banksLimit: 20,
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-15',
      type: 'TRANSACTION',
      name: 'Using too many banks to make payments',
      description:
        'A user is sending/receving payments from too many banks within unit time',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} used {{ banksDif }} more bank(s) above the limit of {{ parameters.banksLimit }} in {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'using-too-many-banks-to-make-payments',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionPaymentMethodCount,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P2',
      types: [RuleTypeField.Diversity],
      typologies: [
        RuleTypology.MoneyMules,
        RuleTypology.AcquiringFraud,
        RuleTypology.Layering,
      ],
      sampleUseCases:
        'A user initiates transactions from four banks within a week, indicating unusual financial behaviour.',
    }
  },
  () => {
    const defaultParameters: UserOnboardedFromHighRiskCountryRuleParameters = {
      checksFor: ['nationality', 'residence', 'registration'],
      highRiskCountries: ['RU', 'SY', 'AF', 'KP', 'SO', 'VE'],
    }

    return {
      id: 'R-20',
      checksFor: [
        RuleChecksForField.UserDetails,
        RuleChecksForField.TransactionCountry,
      ],
      defaultNature: RuleNature.AML,
      typologies: [
        RuleTypology.HighRiskTransactions,
        RuleTypology.TerroristFinancing,
      ],
      defaultAction: 'FLAG',
      defaultCasePriority: 'P1',
      description: 'User onboarded from high risk country',
      descriptionTemplate:
        'User onboarded from a high-risk country ({{ highRiskCountries }})',
      labels: [],
      name: 'User onboarded from high risk country',
      ruleImplementationName: 'user-onboarded-from-high-risk-country',
      defaultParameters,
      sampleUseCases:
        'A user’s country of residence is identified as a high-risk country, prompting a review of their account activity.',
      types: [RuleTypeField.NewActivity, RuleTypeField.RiskExposure],
      type: 'USER',
    }
  },
  () => {
    const defaultParameters: BlacklistCardIssuedCountryRuleParameters = {
      blacklistedCountries: [
        'RU',
        'YE',
        'IR',
        'KP',
        'VE',
        'CU',
        'BY',
        'SY',
        'AF',
      ],
    }
    const defaultFilters: OriginPaymentRuleFiltersParameters = {
      originPaymentFilters: {
        paymentMethods: ['CARD'],
      },
    }

    return {
      id: 'R-22',
      type: 'TRANSACTION',
      name: 'Blacklisted card-issued country',
      description: 'Card-issued country is in the blacklist',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} card is issued from {{ if-sender origin.payment.country destination.payment.country }}, a blacklisted country",
      defaultParameters,
      defaultAction: 'FLAG',
      defaultFilters,
      ruleImplementationName: 'blacklist-card-issued-country',
      labels: [],
      checksFor: [RuleChecksForField.TransactionPaymentMethodIssuedCountry],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        "During a transaction, an individual's card issued country matches an entry in the blacklist database, triggering an immediate hold on the transaction for further investigation.",
    }
  },
  () => {
    const defaultParameters: TransactionReferenceKeywordRuleParameters = {
      keywords: [
        'taliban',
        'isis',
        'bomb',
        'drugs',
        'dog',
        'cat',
        'animal',
        'bet',
        'betting',
        'iran',
        'russia',
        'israel',
        'cuba',
        'revolution',
      ],
    }
    return {
      id: 'R-24',
      type: 'TRANSACTION',
      name: 'Blacklisted Tx reference field',
      description:
        'Transaction reference field includes a keyword in blacklist',
      descriptionTemplate:
        'Keyword “{{ keyword }}” in reference is blacklisted',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transaction-reference-keyword',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionDetails,
        RuleChecksForField.Keywords,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        'A payment with a blacklisted keyword in its reference is automatically flagged by the system for potential fraud review.',
    }
  },
  // TODO: Change Rule Description once rule is split into two
  () => {
    const defaultParameters: TransactionsVelocityRuleParameters = {
      transactionsLimit: 100,
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-30',
      type: 'TRANSACTION',
      name: 'High velocity user',
      description: 'If a user makes >= x transactions within time t',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsDif }} more transaction(s) above the limit of {{ parameters.transactionsLimit }} in {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-velocity',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [
        RuleTypology.MoneyMules,
        RuleTypology.AcquiringFraud,
        RuleTypology.Layering,
      ],
      sampleUseCases:
        'If a person sends several transactions exceeding a set limit (e.g., $10,000) within a brief period (e.g., 24 hours). ',
    }
  },
  () => {
    const defaultParameters: IpAddressMultipleUsersRuleParameters = {
      uniqueUsersCountThreshold: 10,
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
    }
    return {
      id: 'R-52',
      type: 'TRANSACTION',
      name: 'Same IP address for too many users',
      description: "Same IP address for >= 'x' unique user IDs in time 't'",
      descriptionTemplate:
        'Same ip address ({{ ipAddress }}) used by {{ uniqueUsersCount }} unique users',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'ip-address-multiple-users',
      labels: [],
      checksFor: [
        RuleChecksForField.UsersIPAddress,
        RuleChecksForField.NumberOfUsers,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.MoneyMules, RuleTypology.AccountTakeoverFraud],
      sampleUseCases:
        'In a week, an IP address is used by 10 unique users for transactions, exceeding the set limit for unique users per IP.',
    }
  },
  () => {
    const defaultParameters: TooManyUsersForSamePaymentIdentifierParameters = {
      uniqueUsersCountThreshold: 10,
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
    }
    return {
      id: 'R-53',
      type: 'TRANSACTION',
      name: 'Same unique sender payment identifier used by too many users',
      description:
        "Same payment identifier used by >= 'x' unique user IDs in time 't'",
      descriptionTemplate:
        'Same unique payment identifier ({{ uniquePaymentIdentifier }}) used by {{ uniqueUserCount }} unique users',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'too-many-users-for-same-payment-identifier',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionPaymentIdentifier,
        RuleChecksForField.NumberOfUsers,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.AcquiringFraud],
      sampleUseCases:
        'Within a month, 20 user accounts use the same payment identifier, exceeding the unique user threshold for a specific timeframe.',
    }
  },
  () => {
    const defaultParameters: SameUserUsingTooManyPaymentIdentifiersParameters =
      {
        uniquePaymentIdentifiersCountThreshold: 10,
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
      }

    return {
      id: 'R-55',
      type: 'TRANSACTION',
      name: 'Same sender user using too many payment identifiers',
      description:
        'Same sender user using >= ‘x’ unique payment identifiers in time ‘t’',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} used {{ uniquePaymentIdentifiersCount }} unique payment identifiers above the limit of {{ parameters.uniquePaymentIdentifiersCountThreshold }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'same-user-using-too-many-payment-identifiers',
      labels: [],
      checksFor: [
        RuleChecksForField.UserPaymentIdentifier,
        RuleChecksForField.NumberOfUsers,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Diversity],
      typologies: [RuleTypology.CardFraud, RuleTypology.AcquiringFraud],
      sampleUseCases:
        "A user's use of several unique cards within a week hints at possible card testing or fraud.",
    }
  },
  // TODO: Change Rule Description once rule is split into two
  () => {
    const defaultParameters: TransactionsVolumeRuleParameters = {
      transactionVolumeThreshold: {
        [DEFAULT_CURRENCY_KEYWORD]: 10000,
      },
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-69',
      type: 'TRANSACTION',
      name: 'Customer money flow is above the expected volume',
      description:
        'Customer is spending/receiving much more money than expected',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'spending' 'receiving' }} {{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above their expected amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-volume',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.Volume],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'An account typically making $100 monthly transactions suddenly sends $3,000 in three days, triggering an investigation due to the unusual increase.',
    }
  },
  () => {
    const defaultParameters: HighRiskIpAddressCountriesParameters = {
      highRiskCountries: ['RU', 'SY', 'RO', 'UA'],
    }

    return {
      id: 'R-87',
      type: 'TRANSACTION',
      name: 'High risk IP address countries',
      description:
        'Transaction is being sent from or received in a high risk country based on IP address',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} ip-bases country ({{ format-country ipCountry }}) is a High Risk",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-risk-ip-address-countries',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionCountry,
        RuleChecksForField.UsersIPAddress,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P2',
      types: [RuleTypeField.RiskExposure],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user initiates a transaction from a high-risk country, triggering an alert for potential scrutiny.',
    }
  },
  () => {
    const defaultFilters: UserFilters = {
      userType: 'CONSUMER',
    }
    return {
      id: 'R-88',
      type: 'TRANSACTION',
      name: 'Unexpected IP address for user',
      description:
        "IP address where the payment is initiated is outside the following expected location's for the user.",
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} ip-bases country ({{ format-country ipCountry }}) is not country of origin ({{ format-country hitParty.user.userDetails.countryOfResidence }}) or country of nationality ({{ format-country hitParty.user.userDetails.countryOfNationality }})",
      defaultParameters: {},
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'ip-address-unexpected-location',
      labels: [],
      checksFor: [RuleChecksForField.UsersIPAddress],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.AccountTakeoverFraud],
      sampleUseCases:
        'A regular account in Japan initiates an unusual transaction from Sweden.',
    }
  },
  () => {
    return {
      id: 'R-89',
      type: 'TRANSACTION',
      name: 'Transaction risk score exceeds expected limit',
      description:
        'For a given user, compares the expected transaction risk score',
      descriptionTemplate:
        'Transaction risk score: {{ riskScore }} exceeds the expected limit of {{ parameters.riskScoreThreshold }}',
      defaultParameters: {
        riskScoreThreshold: 90,
      } as TransactionRiskScoreRuleParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transaction-risk-score',
      labels: [],
      checksFor: [RuleChecksForField.TransactionRiskScore],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
      types: [RuleTypeField.AnomalyDetection],
      typologies: [
        RuleTypology.UnusualBehaviour,
        RuleTypology.HiddenUnusualRelationships,
      ],
      sampleUseCases: 'A user with a high risk score initiates a transaction.',
    }
  },
  () => {
    return {
      id: 'R-99',
      type: 'TRANSACTION',
      name: 'Transaction value exceeds expected limit',
      description:
        'For a given user, compares the expected transaction count or transaction amount per payment method or in aggregate for multiple time intervals',
      descriptionTemplate: '{{ hitDescription }}',
      defaultParameters: {},
      defaultAction: 'FLAG',
      ruleImplementationName: 'user-transaction-limits',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.TransactionPaymentMethodCount,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.VolumeComparison],
      typologies: [RuleTypology.Structuring, RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user initiates a transaction that exceeds the expected limit.',
    }
  },
  () => {
    const defaultParameters: SenderLocationChangesFrequencyRuleParameters = {
      uniqueCitiesCountThreshold: 1,
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
    }
    return {
      id: 'R-113',
      type: 'TRANSACTION',
      name: 'User location changed too many times based on IP address',
      description: 'Users IP address changes > ‘x’ within time ‘t’',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsCount }} transactions from {{ locationsCount }} locations in more than {{ parameters.timeWindow.units }} {{parameters.timeWindow.granularity}}(s)",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'sender-location-changes-frequency',
      labels: [],
      checksFor: [RuleChecksForField.Time, RuleChecksForField.UsersIPAddress],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.AccountTakeoverFraud],
      sampleUseCases:
        "Over the course of a week, a user's IP address switches between different countries 10 times, exceeding the set limit for IP address changes and raising concerns about the legitimacy of the user's activities.",
    }
  },
  () => {
    const defaultParameters: CardIssuedCountryRuleParameters = {
      allowedCountries: [],
    }
    const defaultFilters: TransactionFilters = {
      originPaymentFilters: {
        paymentMethods: ['CARD'],
      },
    }
    return {
      id: 'R-114',
      type: 'TRANSACTION',
      name: "Card-issued country isn't in the whitelist",
      description:
        "Card is issued in a country that doesn't match the whitelist",
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} card country {{ hitParty.payment.country }} is not whitelisted",
      defaultParameters,
      defaultFilters,
      defaultAction: 'BLOCK',
      ruleImplementationName: 'card-issued-country',
      labels: [],
      checksFor: [RuleChecksForField.TransactionPaymentMethodIssuedCountry],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        'A card issued in a country that is not on the whitelist is automatically blocked from making transactions.',
    }
  },
  () => {
    const defaultParameters: TransactionMatchesPatternRuleParameters = {
      patterns: ['999.99'],
    }
    return {
      id: 'R-117',
      type: 'TRANSACTION',
      name: 'Transaction amount matches a pattern',
      description:
        'Transaction amount ends in a pattern, such as 999 or 000, including decimals',
      descriptionTemplate:
        'Transaction amount of {{ format-money hitParty.amount }} matches a blacklisted pattern ending with {{ matchPattern }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transaction-amount-pattern',
      labels: [],
      checksFor: [RuleChecksForField.TransactionAmount],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.PatternRecognition],
      typologies: [RuleTypology.Structuring],
      sampleUseCases:
        'Recurring user transactions end in .999 (e.g., 150.999, 250.999, 350.999), hinting at a pattern warranting investigation.',
    }
  },
  () => {
    const defaultParameters: PaymentMethodNameRuleParameter = {
      allowedDistancePercentage: 30,
      ignoreEmptyName: false,
    }
    return {
      id: 'R-118',
      type: 'TRANSACTION',
      name: "Account name doesn't match user name",
      description:
        "Name of the account holder doesn't match the user name based on Levenshtein distance. If Levenshtein distance > x, rule is hit",
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} name does not match name on {{ if-sender 'sender’s' 'receiver’s' }} payment method ({{ paymentMethodIdentifier }})",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'payment-method-name-levensthein-distance',
      labels: [],
      checksFor: [RuleChecksForField.Username],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.AccountTakeoverFraud],
      sampleUseCases:
        'A transaction initiated by "JohnDoe123" with an account holder name "JonDo123", triggers the monitoring rule due to the significant Levenshtein distance.',
    }
  },
  () => {
    const defaultParameters: HighTrafficBetweenSamePartiesParameters = {
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
      transactionsLimit: 100,
    }
    return {
      id: 'R-119',
      type: 'TRANSACTION',
      name: 'High velocity between the same parties',
      description:
        'Same parties transacting among themselves >= ‘x’ times in ‘t’',
      descriptionTemplate:
        '{{ delta }} transactions above the limit of {{ parameters.transactionsLimit }} between same Sender and Receiver in {{ format-time-window parameters.timeWindow }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-traffic-between-same-parties',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.Time,
        RuleChecksForField.BothPartiesUsername,
        RuleChecksForField.Username,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [RuleTypology.HiddenUnusualRelationships],
      sampleUseCases:
        'Businesses transacting excessively among themselves within a period, initiating a potential circular trading investigation.',
    }
  },
  // TODO: Change Rule Descriptions once rule is split into two
  () => {
    const defaultParameters: TransactionsAverageAmountExceededParameters = {
      period1: {
        units: 1,
        granularity: 'day',
      },
      period2: {
        units: 2,
        granularity: 'day',
      },
      transactionsNumberThreshold2: {
        min: 5,
      },
      multiplierThreshold: {
        currency: DEFAULT_CURRENCY_KEYWORD,
        value: 200,
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-120',
      type: 'TRANSACTION',
      name: 'Average transaction amount exceed past period average',
      description:
        'The average amount of transactions of a user in the first period, is >= X times higher than avg. amount of transactions in the second periods',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times average amount of transactions in last {{ format-time-window period1 }} than average amount of transactions in last {{ format-time-window period2 }}`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-average-amount-exceeded',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.VolumeComparison],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'In Q1, the average sender user transaction was $1,000, dropping to $100 in Q2, triggering a rule for further investigation.',
    }
  },
  // TODO: Change Rule Description once rule is split into two
  () => {
    const defaultParameters: TransactionsAverageNumberExceededParameters = {
      period1: {
        units: 1,
        granularity: 'day',
      },
      period2: {
        units: 2,
        granularity: 'day',
      },
      transactionsNumberThreshold2: {
        min: 5,
      },
      multiplierThreshold: 200,
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-121',
      type: 'TRANSACTION',
      name: 'Average transactions number exceed past period average number',
      description:
        'The average daily number of transactions of a user in the last t1 days, is >= X times higher than avg daily transactions in t2 days',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times avg. number of transactions in last {{ format-time-window period1 }} than avg. number of transactions in last {{ format-time-window period2 }}`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-average-number-exceeded',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.VelocityComparison],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        "User's avg daily transactions increase significantly in the first month and drop the next, indicating a possible change in transaction behaviour or risk profile.",
    }
  },
  // TODO: Change Rule Description once rule is split into two
  () => {
    const defaultParameters: TransactionsAverageAmountExceededParameters = {
      period1: {
        units: 1,
        granularity: 'day',
      },
      period2: {
        units: 2,
        granularity: 'day',
      },
      transactionsNumberThreshold2: {
        min: 5,
      },
      multiplierThreshold: {
        currency: DEFAULT_CURRENCY_KEYWORD,
        value: 200,
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-122',
      type: 'TRANSACTION',
      name: 'Average daily transaction amount exceed past period average',
      description:
        'The average daily amount of transactions of a user in the first period, is >= X times higher than avg. amount of transactions in the second periods',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times average daily amount of transactions in last {{ format-time-window period1 }} than average daily amount of transactions in last {{ format-time-window period2 }}`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-average-daily-amount-exceeded',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.VolumeComparison],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'In early May (t1), sender’s daily transaction was $200 on average, which dropped to $20 daily in late May (t2), triggering an alert due to this significant decrease.',
    }
  },
  // TODO: Change rule description when rule is split into two
  () => {
    const defaultParameters: TransactionVolumeExceedsTwoPeriodsRuleParameters =
      {
        checkReceiver: 'receiving',
        checkSender: 'sending',
        multiplierThreshold: {
          currency: 'USD',
          value: 500,
        },
        period1: {
          units: 7,
          granularity: 'day',
        },
        period2: {
          units: 30,
          granularity: 'day',
        },
      }

    return {
      id: 'R-27',
      name: 'Total transaction volume exceed past period total transaction volume',
      type: 'TRANSACTION',
      description:
        'The total volume of transactions of a user in the last t1 days, is >= X times higher than total volume of transactions in t2 days',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more then {{ to-fixed multiplier }} times value of transactions in last {{ format-time-window period1 }} than value of transactions in last {{ format-time-window period2 }}`,
      defaultParameters,
      defaultAction: 'FLAG',
      defaultCasePriority: 'P1',
      defaultNature: RuleNature.FRAUD,
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.Time,
      ],
      ruleImplementationName: 'total-transactions-volume-exceeds',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.VolumeComparison],
      typologies: [
        RuleTypology.MoneyMules,
        RuleTypology.AcquiringFraud,
        RuleTypology.Layering,
      ],
      sampleUseCases:
        "In the last 15 days, a user's transactions surged to $50,000 from the previous 30-day total of $5,000, with a possibility for potential unusual activity.",
    }
  },
  () => {
    const defaultParameters: HighTrafficVolumeBetweenSameUsersParameters = {
      timeWindow: {
        units: 1,
        granularity: 'hour',
      },
      transactionVolumeThreshold: {
        [DEFAULT_CURRENCY_KEYWORD]: 10000,
      },
    }
    return {
      id: 'R-126',
      type: 'TRANSACTION',
      name: 'High volume between the same parties',
      description:
        'Same parties transacting among themselves of amount >= ‘x’ in ‘t’',
      descriptionTemplate:
        'Transaction volume {{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above their expected amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }} between two users in {{ format-time-window parameters.timeWindow }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-traffic-volume-between-same-users',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.Time,
        RuleChecksForField.BothPartiesUsername,
        RuleChecksForField.Username,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      types: [RuleTypeField.Volume],
      typologies: [RuleTypology.HiddenUnusualRelationships],
      sampleUseCases:
        'Two users repeatedly transact between each other, exchanging sums above $10,000 within a single week.',
    }
  },
  () => {
    const defaultParameters: TransactionsRoundValuePercentageRuleParameters = {
      timeWindow: {
        units: 7,
        granularity: 'day',
      },
      patternPercentageLimit: 50,
      initialTransactions: 10,
    }

    return {
      id: 'R-124',
      type: 'TRANSACTION',
      name: 'Too many round transactions',
      description:
        'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds with more than {{ parameters.patternPercentageLimit }}% of transactions as round values ending in 00.00 (hundreds without cents) within time {{ format-time-window parameters.timeWindow }}. Rule should hit after the user has initiaited {{ parameters.initialTransactions }} transactions (doesn't have to be successful)",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-round-value-percentage',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Diversity],
      typologies: [RuleTypology.Structuring, RuleTypology.UnusualBehaviour],
      sampleUseCases:
        "A user's account receives 10 transactions of round values (e.g., $100, $200, $300) within a single day, exceeding the set limit for round transactions and raising concerns about the legitimacy of the user's activities.",
    }
  },
  () => {
    const defaultParameters: HighUnsuccessfullStateRateParameters = {
      transactionStates: ['REFUNDED'],
      threshold: 1,
      minimumTransactions: 3,
      timeWindow: {
        units: 7,
        granularity: 'day',
      },
      checkSender: 'sending',
      checkReceiver: 'receiving',
    }
    return {
      id: 'R-125',
      type: 'TRANSACTION',
      name: 'High percentage of unsuccesful state transactions',
      description:
        "A user's transaction (all, sending, or receiving) has >= x% of all transactions in a specific state (e.g. Refund) in time t. Rule is activated after the user initiates y number of transactions in total (all, sending, or receiving)",
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} has more than {{ to-fixed parameters.threshold }}% of all transactions in “{{ parameters.transactionStates}}” states within {{ format-time-window parameters.timeWindow }}. The rule is activated after the user initiates {{ parameters.minimumTransactions }} number of transactions in total.",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-unsuccessfull-state-rate',
      labels: [],
      checksFor: [RuleChecksForField.TransactionState, RuleChecksForField.Time],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [
        RuleTypology.AcquiringFraud,
        RuleTypology.CardFraud,
        RuleTypology.AccountTakeoverFraud,
        RuleTypology.IssuingFraud,
      ],
      sampleUseCases:
        "A user's account has a high percentage of transactions in a specific state (e.g., Refund) within a single day, exceeding the set limit for transactions in a specific state and raising concerns about the legitimacy of the user's activities.",
    }
  },
  () => {
    const defaultParameters: TooManyTransactionsToHighRiskCountryRuleParameters =
      {
        timeWindow: {
          units: 1,
          granularity: 'hour',
        },
        transactionsLimit: 2,
        highRiskCountries: [],
        checkSender: 'all',
        checkReceiver: 'all',
      }

    return {
      id: 'R-77',
      type: 'TRANSACTION',
      name: 'Too Many Transactions To High Risk Country',
      description:
        'User receives or send >= x transactions in time t from/to high risk country',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} performed more than {{ parameters.transactionsLimit }} transactions with {{ if-sender 'sending' 'receiving' }} country which is high risk in {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'too-many-transactions-to-high-risk-country',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionCountry,
        RuleChecksForField.Time,
        RuleChecksForField.CounterpartyCountryCount,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [
        RuleTypology.HighRiskTransactions,
        RuleTypology.TerroristFinancing,
      ],
      sampleUseCases:
        "A user's account receives 10 transactions from a high-risk country within a single day, exceeding the set limit for transactions from high-risk countries and raising concerns about the legitimacy of the user's activities.",
    }
  },
  // TODO: Change Rule Description when Rule is Split into two
  () => {
    const defaultParameters: TooManyCounterpartyCountryRuleParameters = {
      timeWindow: {
        units: 1,
        granularity: 'hour',
      },
      transactionsLimit: 2,
      checkSender: 'all',
      checkReceiver: 'all',
    }

    return {
      id: 'R-123',
      type: 'TRANSACTION',
      name: 'Too many counterparty countries',
      description:
        'User is receiving or sending funds from > X different countries in time t',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds from more than {{ parameters.transactionsLimit }} unique country within {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'too-many-counterparty-country',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionCountry,
        RuleChecksForField.Time,
        RuleChecksForField.CounterpartyCountryCount,
      ],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Diversity],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'In a single week, a sender sent transactions to 8 distinct countries, indicating a potential pattern of irregular activity.',
    }
  },
  () => {
    const defaultParameters: TransactionsRoundValueVelocityRuleParameters = {
      timeWindow: {
        units: 7,
        granularity: 'day',
      },
      transactionsLimit: 10,
    }
    return {
      id: 'R-130',
      type: 'TRANSACTION',
      name: 'Too many round transactions to the same user',
      description:
        'User receives or sends >= x round transactions within time t',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} {{ parameters.transactionsLimit }} or more transactions as round values ending in 00.00 (hundreds without cents) within time {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-round-value-velocity',
      labels: [],
      checksFor: [RuleChecksForField.NumberOfTransactions],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Velocity],
      typologies: [RuleTypology.Structuring, RuleTypology.UnusualBehaviour],
      sampleUseCases:
        "A user's account receives 10 transactions of $100.00 within a single day, exceeding the set limit for round transactions and raising concerns about the legitimacy of the user's activities.",
    }
  },
  () => {
    const defaultParameters: SamePaymentDetailsParameters = {
      threshold: 2,
      timeWindow: {
        units: 7,
        granularity: 'day',
      },
      checkSender: 'all',
      checkReceiver: 'all',
    }
    return {
      id: 'R-94',
      type: 'TRANSACTION',
      name: 'Payment identifier used too frequently',
      description:
        'Particular payment identifier (card fingerprint, account number etc.) is used too many times at the origin or destination of a transaction within a specified time period (1 day, 2 hours etc.)',
      descriptionTemplate:
        'Same payment identifier used {{ numberOfUses }} times within {{ format-time-window parameters.timeWindow }}, which is more or equal than threshold of {{ parameters.threshold }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'same-payment-details',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionPaymentIdentifier,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Diversity],
      typologies: [RuleTypology.HiddenUnusualRelationships],
      sampleUseCases:
        "A user's account number is used in 10 transactions within a single day, exceeding the set limit for account number usage and raising concerns about the legitimacy of the user's activities.",
    }
  },
  () => {
    const defaultParameters: BlacklistPaymentdetailsRuleParameters = {
      blacklistedIBANPaymentDetails: [],
    }
    return {
      id: 'R-129',
      type: 'TRANSACTION',
      name: 'Blacklisted payment details',
      description: 'Payment details that are in the blacklist',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} payment details are in blacklisted payment details",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'blacklist-payment-details',
      labels: [],
      checksFor: [RuleChecksForField.TransactionPaymentDetails],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        "During a transaction, an individual's user’s payment details matches an entry in the blacklist database, triggering an immediate hold on the transaction for further investigation.",
    }
  },
  // TODO: Change Rule Description when Rule is Split into two
  () => {
    const defaultParameters: TransactionsExceedPastPeriodRuleParameters = {
      multiplierThreshold: 100,
      timeWindow1: {
        units: 1,
        granularity: 'day',
      },
      timeWindow2: {
        units: 2,
        granularity: 'day',
      },
      checkSender: 'all',
      checkReceiver: 'all',
    }
    return {
      id: 'R-131',
      type: 'TRANSACTION',
      name: 'Transactions exceed past period',
      description:
        'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} {{ if-sender 'sending' 'receiving' }} transaction(s) in {{ format-time-window parameters.timeWindow1 }} is more than {{ parameters.multiplierThreshold }} times in {{ format-time-window parameters.timeWindow2 }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-exceed-past-period',
      labels: [],
      checksFor: [
        RuleChecksForField.NumberOfTransactions,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.VelocityComparison],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'When a user does 200 transactions in the first quarter, but only 20 in the next, due to the significant drop in activity.',
    }
  },
  () => {
    const defaultParameters: BlacklistTransactionMatchedFieldRuleParameters = {
      blacklistId: '',
    }

    return {
      id: 'R-132',
      name: 'Blacklist transaction related value',
      type: 'TRANSACTION',
      description:
        'Blacklist specific values for a variable type such as card fingerprint, bank account number etc.',
      descriptionTemplate:
        '{{ value }} is blacklisted in Blacklist ID {{ blackListId }} for {{ variableType }} field',
      defaultParameters,
      defaultAction: 'BLOCK',
      ruleImplementationName: 'blacklist-transaction-related-value',
      labels: [],
      checksFor: [RuleChecksForField.UserDetails],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P3',
      types: [RuleTypeField.Blacklist],
      typologies: [RuleTypology.InternalBlacklists],
      sampleUseCases:
        "During a transaction, an individual's user ID matches an entry in the blacklist database, triggering an immediate hold on the transaction for further investigation.",
    }
  },
  () => {
    const defaultParameters: TransactionsOutflowInflowVolumeRuleParameters = {
      timeWindow: {
        units: 30,
        granularity: 'day',
      },
      outflowTransactionTypes: ['WITHDRAWAL'],
      inflowTransactionTypes: ['DEPOSIT'],
      outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
    }

    return {
      id: 'R-41',
      name: 'Transaction’s sending volume compared to receiving volume',
      type: 'TRANSACTION',
      description:
        'Compare transaction’s sending volume with receiving’s volume',
      descriptionTemplate:
        'Transaction outflow volume ({{ format-money outflowAmount }}) is {{ format-comparator parameters.outflowInflowComparator }} transaction inflow volume ({{ format-money inflowAmount }})',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-outflow-inflow-volume',
      labels: [],
      checksFor: [
        RuleChecksForField.TransactionAmount,
        RuleChecksForField.TransactionType,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.VolumeComparison],
      typologies: [RuleTypology.MoneyMules, RuleTypology.Layering],
      sampleUseCases:
        'A user sent transactions worth $30,000 in a month but received only $3,000, triggering further analysis due to the large discrepancy.',
    }
  },
  () => {
    const defaultParameters: PaymentDetailChangeRuleParameters = {
      timeWindow: {
        units: 1,
        granularity: 'day',
      },
      oldNamesThreshold: 1,
      initialTransactions: 1,
      allowedDistancePercentage: 30,
      ignoreEmptyName: true,
    }
    return {
      id: 'R-45',
      name: 'New name on Bank Account',
      type: 'TRANSACTION',
      description:
        'Current payment’s bank account name mismatches with the bank account name of previous payments by same user.',
      descriptionTemplate: `{{ if-sender 'Sender’s' 'Receiver’s' }} bank account holder name has changed.`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'bank-account-holder-name-change',
      labels: [],
      checksFor: [
        RuleChecksForField.accountHolderName,
        RuleChecksForField.Time,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user used 3 different bank account names in a month, indicating possible account takeover or fraud.',
    }
  },
  () => {
    const defaultParameters: SanctionsBusinessUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
      screeningTypes: [],
    }

    return {
      id: 'R-128',
      name: 'Business user screening - Shareholders, dirs & legal name',
      type: 'USER',
      description:
        'Business legal entity & shareholders & directors screening for Sanctions/PEP/Adverse media screening',
      descriptionTemplate:
        'Business legal entity & shareholders & directors screening for Sanctions/PEP/Adverse media screening',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-business-user',
      labels: [],
      checksFor: [
        RuleChecksForField.UserDetails,
        RuleChecksForField.EntityName,
      ],
      defaultNature: RuleNature.SCREENING,
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
      types: [RuleTypeField.Screening],
      typologies: [RuleTypology.ScreeningHits],
      sampleUseCases:
        'A merchant or business user can check for sanctions/PEP/AM match of their shareholders & directors.',
    }
  },
  () => {
    const defaultParameters: SanctionsBankUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
      screeningTypes: [],
    }

    return {
      id: 'R-32',
      name: 'Screening bank names',
      type: 'USER',
      description:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution is possible',
      descriptionTemplate:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution is possible',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-bank-name',
      labels: [],
      checksFor: [RuleChecksForField.UsersBankName],
      defaultNature: RuleNature.SCREENING,
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
      types: [RuleTypeField.Screening],
      typologies: [RuleTypology.ScreeningHits],
      sampleUseCases:
        'Resolve an IBAN number to check if the bank name have matched against Sanctions/ PEP/ AM.',
    }
  },
  () => {
    const defaultParameters: UserInactivityRuleParameters = {
      inactivityDays: 365,
      checkDirection: 'sending',
    }

    return {
      id: 'R-33',
      name: 'User inactivity',
      type: 'USER_ONGOING_SCREENING',
      description: 'Check if a user has been inactive for x days',
      descriptionTemplate:
        'User has been inactive for more than {{ parameters.inactivityDays }} days',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'user-inactivity',
      labels: [],
      checksFor: [RuleChecksForField.Time],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P1',
      types: [RuleTypeField.AnomalyDetection, RuleTypeField.Screening],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user has been inactive for more than 365 days, prompting a review of the account.',
    }
  },
  () => {
    const defaultParameters: SanctionsCounterPartyRuleParameters = {
      fuzziness: 20,
      screeningTypes: [],
    }

    return {
      id: 'R-169',
      name: 'Tx’s counterparty screening',
      type: 'TRANSACTION',
      description:
        'Screening transaction’s counterparty for Sanctions/PEP/Adverse media',
      descriptionTemplate:
        'Screening transaction’s counterparty for Sanctions/PEP/Adverse media',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-counterparty',
      labels: [],
      checksFor: [
        RuleChecksForField.CounterpartyUsername,
        RuleChecksForField.CounterpartyBankName,
      ],
      defaultNature: RuleNature.SCREENING,
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
      types: [RuleTypeField.Screening],
      typologies: [RuleTypology.ScreeningHits],
      sampleUseCases:
        "A transaction’s recipient's name and bank name are checked against Sanctions/ PEP/ AM sanctions list, prompting further investigation.",
    }
  },
  () => {
    const defaultParameters: SanctionsConsumerUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
      screeningTypes: [],
    }

    return {
      id: 'R-16',
      name: 'Screening consumer users',
      type: 'USER',
      description:
        'Screening on consumer users name and Y.O.B for Sanctions/PEP/Adverse media',
      descriptionTemplate:
        'Screening on consumer users name and Y.O.B for Sanctions/PEP/Adverse media',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-consumer-user',
      labels: [],
      checksFor: [
        RuleChecksForField.Username,
        RuleChecksForField.UserDetails,
        RuleChecksForField.UsersYearOfBirth,
      ],
      defaultNature: RuleNature.SCREENING,
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
      types: [RuleTypeField.Screening],
      typologies: [RuleTypology.ScreeningHits],
      sampleUseCases:
        'A consumer user can be checked for sanctions/PEP/AM match.',
    }
  },
  () => {
    const defaultParameters: MerchantMonitoringIndustryUserRuleParameters = {
      sourceType: MERCHANT_MONITORING_SOURCE_TYPES,
    }

    return {
      id: 'R-17',
      name: 'Business industry change',
      type: 'USER',
      description:
        'Checks if industry has changed for a business user on an external platforms',
      descriptionTemplate:
        'Business industry for user has changed on {{ sourceType }}',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'merchant-monitoring-industry',
      labels: [],
      checksFor: [
        RuleChecksForField.UserDetails,
        RuleChecksForField.UsersIndustry,
      ],
      defaultNature: RuleNature.SCREENING,
      defaultCasePriority: 'P1',
      requiredFeatures: ['MERCHANT_MONITORING'],
      types: [RuleTypeField.MerchantMonitoring],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'An alert is triggered when a company, previously listed as technology on a professional network, suddenly switches to healthcare, suggesting a possible profile discrepancy.',
    }
  },

  () => {
    const defaultParameters: UserAddressChangeRuleParameters = {}

    return {
      id: 'R-61',
      name: 'User address change',
      type: 'USER',
      description:
        'Check if user address has changed.For business users its legal entity’s address is used. For consumer users their own address is used',
      descriptionTemplate: 'User address has changed',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'user-address-change',
      labels: [],
      checksFor: [
        RuleChecksForField.UserDetails,
        RuleChecksForField.UsersAddress,
      ],
      defaultNature: RuleNature.FRAUD,
      defaultCasePriority: 'P2',
      types: [RuleTypeField.MerchantMonitoring],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'The system temporarily halts frequent online shopping transactions for verification if it detects multiple recent home address changes.',
    }
  },
  () => {
    const defaultParameters: PaymentDetailChangeRuleParameters = {
      oldNamesThreshold: 1,
      timeWindow: {
        units: 30,
        granularity: 'day',
      },
      initialTransactions: 0,
      allowedDistancePercentage: 0,
    }

    return {
      id: 'R-155',
      name: 'Bank name change',
      type: 'TRANSACTION',
      description: 'If user’s bank name is changed > ‘x’ times in ‘t’',
      descriptionTemplate: `{{ if-sender 'Sender’s' 'Receiver’s' }} bank name has changed.`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'bank-name-change',
      labels: [],
      checksFor: [RuleChecksForField.UsersBankName, RuleChecksForField.Time],
      defaultNature: RuleNature.AML,
      defaultCasePriority: 'P2',
      types: [RuleTypeField.AnomalyDetection],
      typologies: [RuleTypology.UnusualBehaviour],
      sampleUseCases:
        'A user updated their bank details four times in a month, indicating possible account takeover or fraud.',
    }
  },
]

export const RULES_LIBRARY: Array<Rule> = _RULES_LIBRARY.map((getRule) => {
  const rule = getRule()
  const v8Config = getMigratedV8Config(
    rule.id,
    rule.defaultParameters,
    rule.defaultFilters
  )
  return {
    ...rule,
    parametersSchema:
      rule.type === 'TRANSACTION'
        ? TRANSACTION_RULES[rule.ruleImplementationName]?.getSchema()
        : rule.type === 'USER'
        ? USER_RULES[rule.ruleImplementationName]?.getSchema()
        : USER_ONGOING_SCREENING_RULES[
            rule.ruleImplementationName
          ]?.getSchema(),
    defaultLogic: v8Config?.logic,
    defaultLogicAggregationVariables: v8Config?.logicAggregationVariables,
    defaultBaseCurrency: v8Config?.baseCurrency,
  }
})

export const ONGOING_MERCHANT_MONITORING_RULE_IDS = ['R-17']

export const RULES_LOOKUP: Map<string, Rule> = new Map(
  RULES_LIBRARY.map((r) => [r.id, r])
)

export function getRuleByRuleId(ruleId: string): Rule {
  return RULES_LOOKUP.get(ruleId) as Rule
}

export function getRuleByImplementation(
  ruleImplementationName: string
): Rule | null {
  return RULES_LIBRARY.find(
    (r) => r.ruleImplementationName === ruleImplementationName
  ) as Rule
}
