/**
 * This file is the source of truth of all our rules.
 * We'll deploy the rules defined here automatically during the deployment process.
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1xAl3cqF6cGMyFTpiIOXguyq7P_EGlTldbOWCYj0lMA8
 */

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
import { TooManyUsersForSameCardParameters } from './too-many-users-for-same-card'
import { SameUserUsingTooManyCardsParameters } from './same-user-using-too-many-cards'
import { TransactionsVolumeRuleParameters } from './transactions-volume'
import { ConsecutiveTransactionSameTypeRuleParameters } from './consecutive-transactions-same-type'
import { SenderLocationChangesFrequencyRuleParameters } from './sender-location-changes-frequency'
import { CardIssuedCountryRuleParameters } from './card-issued-country'
import { TransactionMatchesPatternRuleParameters } from './transaction-amount-pattern'
import { CardHolderNameRuleParameter } from './card-holder-name-levensthein-distance'
import { HighTrafficBetweenSamePartiesParameters } from './high-traffic-between-same-parties'
import { HighTrafficVolumeBetweenSameUsersParameters } from './high-traffic-volume-between-same-users'
import { TransactionsRoundValuePercentageRuleParameters } from './transactions-round-value-percentage'
import { TooManyTransactionsToHighRiskCountryRuleParameters } from './too-many-transactions-to-high-risk-country'
import { TooManyCounterpartyCountryRuleParameters } from './too-many-counterparty-country'
import { TransactionsRoundValueVelocityRuleParameters } from './transactions-round-value-velocity'
import { BlacklistPaymentdetailsRuleParameters } from './blacklist-payment-details'
import { TransactionsExceedPastPeriodRuleParameters } from './transactions-exceed-past-period'
import { TRANSACTION_RULES } from './index'
import { Rule } from '@/@types/openapi-internal/Rule'
import { HighUnsuccessfullStateRateParameters } from '@/services/rules-engine/transaction-rules/high-unsuccessfull-state-rate'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-amount-exceeded'
import { TransactionsAverageNumberExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-number-exceeded'
import { SamePaymentDetailsParameters } from '@/services/rules-engine/transaction-rules/same-payment-details'

const _TRANSACTION_RULES_LIBRARY: Array<() => Omit<Rule, 'parametersSchema'>> =
  [
    () => ({
      id: 'R-1',
      type: 'TRANSACTION',
      name: 'First payment of a Customer',
      description: 'First transaction of a user',
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} first transaction",
      defaultParameters: {},
      defaultAction: 'FLAG',
      ruleImplementationName: 'first-payment',
      labels: ['AML'],
      defaultCasePriority: 'P1',
      defaultCaseCreationType: 'TRANSACTION',
    }),
    () => {
      const defaultParameters: TransactionAmountRuleParameters = {
        transactionAmountThreshold: {
          USD: 10000,
        },
      }
      return {
        id: 'R-2',
        type: 'TRANSACTION',
        name: 'Transaction amount too high',
        description: 'Transaction amount is >= x in USD or equivalent',
        descriptionTemplate:
          'Transaction amount is {{ format-money limit currency }} or more',
        defaultParameters,
        defaultAction: 'SUSPEND',
        ruleImplementationName: 'transaction-amount',
        labels: ['AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TransactionNewCountryRuleParameters = {
        initialTransactions: 10,
      }
      return {
        id: 'R-3',
        type: 'TRANSACTION',
        name: 'Unexpected origin or destination country',
        description:
          'Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.',
        descriptionTemplate:
          "User tried to {{ if-sender 'send' 'receive' }} money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.amount.country }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money {{ if-sender 'from' 'to' }} {{ if-sender origin.amount.country destination.payment.country }} prior",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-new-country',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TransactionNewCurrencyRuleParameters = {
        initialTransactions: 10,
      }
      return {
        id: 'R-4',
        type: 'TRANSACTION',
        name: 'Unexpected origin or destination currency',
        description:
          'Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.',
        descriptionTemplate:
          "User tried to {{ if-sender 'send' 'receive' }} money in {{ hitParty.amount.currency }} more than {{ parameters.initialTransactions }} times. User has not {{ if-sender 'sent' 'received' }} any money in {{ hitParty.amount.currency }} prior",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-new-currency',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: FirstActivityAfterLongTimeRuleParameters = {
        dormancyPeriodDays: 360,
      }
      return {
        id: 'R-5',
        type: 'TRANSACTION',
        name: 'Dormant accounts',
        description:
          'If a user has made a transaction after being inactive for time t, suspend user & transactions',
        descriptionTemplate:
          'User made a transaction from an account which was dormant for {{ parameters.dormancyPeriodDays }} days',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'first-activity-after-time-period',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: HighRiskCurrencyRuleParameters = {
        highRiskCurrencies: ['AFN', 'BYN', 'KPW', 'LYD', 'RUB', 'SYP'],
      }
      return {
        id: 'R-6',
        type: 'TRANSACTION',
        name: 'High risk currency',
        description:
          'Transaction includes a currency that is designated as high risk. Mostly relevant for when you are moving funds between different currencies. This rule uses a customizable list.',
        descriptionTemplate:
          "{{ if-sender 'Sender’s' 'Receiver’s' }} currency ({{ hitParty.amount.currency }}) is a High Risk",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'high-risk-currency',
        labels: ['AML', 'Sanctions', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: LowValueTransactionsRuleParameters = {
        lowTransactionValues: {
          EUR: {
            max: 1000,
            min: 990,
          },
        },
        lowTransactionCount: 3,
      }
      return {
        id: 'R-7',
        type: 'TRANSACTION',
        name: 'Too many inbound transactions under reporting limit',
        description:
          '>= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'low-value-incoming-transactions',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: LowValueTransactionsRuleParameters = {
        lowTransactionValues: {
          EUR: {
            max: 1000,
            min: 990,
          },
        },
        lowTransactionCount: 3,
      }
      return {
        id: 'R-8',
        type: 'TRANSACTION',
        name: 'Too many outbound transactions under reporting limit',
        description:
          '>= x number of low value outgoing transaction(s) just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
        descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transaction(s) just under the flagging limit`,
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'low-value-outgoing-transactions',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        name: 'Too many customers for a single counterparty',
        description:
          'More than x users transacting with a single counterparty over a set period of time t (E.g. Nigerian prince scam outbound)',
        descriptionTemplate:
          'More than {{ parameters.sendersCount }} users transacting with a single counterparty over a set period of {{ format-time-window parameters.timeWindow }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'multiple-user-senders-within-time-period',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        name: 'Too many counterparties for a single customer',
        description:
          'More than x counterparties transacting with a single user over a set period of time t (E.g. Nigerian prince scam inbound)',
        descriptionTemplate:
          'More than {{ parameters.sendersCount }} counterparties transacting with a single user over a set period of {{ format-time-window parameters.timeWindow }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName:
          'multiple-counterparty-senders-within-time-period',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: MerchantReceiverNameRuleParameters = {
        merchantNames: [],
      }
      return {
        id: 'R-13',
        type: 'TRANSACTION',
        name: 'Blacklisted Merchant receiver name',
        description: 'Merchant name is in the blacklist',
        descriptionTemplate: '{{ receiverName }} is blacklisted',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'merchant-receiver-name',
        labels: ['AML', 'Risk Appetite', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
      return {
        id: 'R-22',
        type: 'TRANSACTION',
        name: 'Blacklisted card-issued country',
        description: 'Card-issued country is in the blacklist',
        descriptionTemplate:
          "{{ if-sender 'Sender’s' 'Receiver’s' }} card is issued from {{ if-sender origin.payment.country destination.payment.country }}, a blacklisted country",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'blacklist-card-issued-country',
        labels: ['AML', 'Risk Appetite', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        name: 'Reference field keyword',
        description: 'Payment reference field includes a keyword in blacklist',
        descriptionTemplate:
          'Keyword “{{ keyword }}” in reference is blacklisted',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-reference-keyword',
        labels: ['AML', 'Risk Appetite', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
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
        labels: ['Internal Fraud', 'AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: IpAddressMultipleUsersRuleParameters = {
        uniqueUsersCountThreshold: 10,
        timeWindowInDays: 1,
      }
      return {
        id: 'R-52',
        type: 'TRANSACTION',
        name: 'Same IP address for too many users',
        description: 'Same IP address for >= x unique user IDs',
        descriptionTemplate:
          'Same ip address ({{ ipAddress }}) used by {{ uniqueUsersCount }} unique users',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'ip-address-multiple-users',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TooManyUsersForSameCardParameters = {
        uniqueUsersCountThreshold: 10,
        timeWindowInDays: 1,
      }
      return {
        id: 'R-53',
        type: 'TRANSACTION',
        name: 'Same card used by too many users',
        description: 'Same card used by  >= x unique user IDs',
        descriptionTemplate:
          'Same card ({{ cardFingerprint }}) used by {{ uniqueUserCount }} unique users',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'too-many-users-for-same-card',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: SameUserUsingTooManyCardsParameters = {
        uniqueCardsCountThreshold: 10,
        timeWindowInDays: 1,
      }
      return {
        id: 'R-54',
        type: 'TRANSACTION',
        name: 'Same user using too many cards',
        description:
          'Same user using >= x unique cards counted by card fingerprint id',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} used {{ uniqueCardsCount }} unique cards above the limit of {{ parameters.uniqueCardsCountThreshold }}",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'same-user-using-too-many-cards',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TransactionsVolumeRuleParameters = {
        transactionVolumeThreshold: {
          USD: 10000,
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
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TransactionAmountRuleParameters = {
        transactionAmountThreshold: {
          EUR: 10000,
          USD: 10000,
        },
      }
      return {
        id: 'R-75',
        type: 'TRANSACTION',
        name: 'Currency transaction report needed',
        description:
          'If a transaction amount is more than x - a "CTR" is required by law. x depends on jurisdiction. EU is 10,000 euro; US is 10,000 USD',
        descriptionTemplate:
          "CTR required since {{ if-sender 'sending' 'receiving' }} {{ format-money hitParty.amount }} is above {{ format-money limit currency }}",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-amount',
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      return {
        id: 'R-88',
        type: 'TRANSACTION',
        name: 'Unexpected IP address for user',
        description:
          "\"IP address where the payment is initiated is outside the following expected location's for the user: user's country of residence, user's nationality country, user's previously approved transaction countries\n\nPreviously approved mean if this rule was hit and it's unsuspended on Console, log that country that was approved and add it to the whitelisted country\"",
        descriptionTemplate:
          "{{ if-sender 'Sender’s' 'Receiver’s' }} ip-bases country ({{ format-country ipCountry }}) is not country of origin ({{ format-country hitParty.user.userDetails.countryOfResidence }}) or country of nationality ({{ format-country hitParty.user.userDetails.countryOfNationality }})",
        defaultParameters: {},
        defaultAction: 'FLAG',
        ruleImplementationName: 'ip-address-unexpected-location',
        labels: ['AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      return {
        id: 'R-99',
        type: 'TRANSACTION',
        name: 'Transaction value exceeds customer declared limit x',
        description:
          'For a given user, user-declared transaction amount is <= x. Customers define an expected transaction amount when they are onboarding - this will compare that variable on their profile',
        descriptionTemplate:
          "{{ if-sender 'Sender sent' 'Receiver received' }} a transaction amount of {{ format-money hitParty.amount }} more than the limit of {{ format-money transactionLimit }}",
        defaultParameters: {},
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-amount-user-limit',
        labels: ['AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: ConsecutiveTransactionSameTypeRuleParameters = {
        targetTransactionsThreshold: 5,
        transactionTypes: ['DEPOSIT'],
        otherTransactionTypes: ['EXTERNAL_PAYMENT'],
        timeWindowInDays: 30,
      }
      return {
        id: 'R-101',
        type: 'TRANSACTION',
        name: 'Isolated crypto users',
        description:
          'A user makes >= x crypto transactions without any fiat transactions',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} made {{ parameters.targetTransactionsThreshold }} or more crypto transactions without any fiat transactions",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'consecutive-transactions-same-type',
        labels: ['AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: SenderLocationChangesFrequencyRuleParameters = {
        uniqueCitiesCountThreshold: 1,
        timeWindowInDays: 1,
      }
      return {
        id: 'R-113',
        type: 'TRANSACTION',
        name: 'User city changes too many times based on IP address',
        description: 'Users IP address show > x different cities within t days',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} made {{ transactionsCount }} transactions from {{ locationsCount }} locations in more than {{ parameters.timeWindowInDays }} day(s)",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'sender-location-changes-frequency',
        labels: ['AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: CardIssuedCountryRuleParameters = {
        allowedCountries: [],
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
        defaultAction: 'BLOCK',
        ruleImplementationName: 'card-issued-country',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
          'If a transaction amount is ending in a certain pattern, rule is hit. E.g. Amount ends in 999 or 000. This rule also accounts for decimals.',
        descriptionTemplate:
          'Transaction amount of {{ format-money hitParty.amount }} matches a blacklisted pattern ending with {{ matchPattern }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transaction-amount-pattern',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: CardHolderNameRuleParameter = {
        allowedDistancePercentage: 30,
      }
      return {
        id: 'R-118',
        type: 'TRANSACTION',
        name: "Card holder name doesn't match user name",
        description:
          "Name of the card holder doesn't match the user name based on Levenshtein distance. If Levenshtein distance > x, rule is hit",
        descriptionTemplate:
          "{{ if-sender 'Sender’s' 'Receiver’s' }} name does not match name on {{ if-sender 'sender’s' 'receiver’s' }} card ({{ cardFingerprint }})",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'card-holder-name-levensthein-distance',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        name: 'High traffic between the same parties',
        description:
          'Same receiver and destination details are used >= x times in time t',
        descriptionTemplate:
          '{{ delta }} transactions above the limit of {{ parameters.transactionsLimit }} between same Sender and Receiver in {{ format-time-window parameters.timeWindow }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'high-traffic-between-same-parties',
        labels: [],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
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
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
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
          currency: 'EUR',
          value: 200,
        },
        checkSender: 'sending',
        checkReceiver: 'receiving',
      }
      return {
        id: 'R-122',
        type: 'TRANSACTION',
        name: 'Average transaction amount exceed past period average',
        description:
          'The average daily amount of transactions of a user in the first period, is >= X times higher than avg. amount of transactions in the second periods',
        descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times avg. amount of transactions in last {{ format-time-window period1 }} than avg. amount of transactions in last {{ format-time-window period2 }}`,
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transactions-average-amount-exceeded',
        labels: ['Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: HighTrafficVolumeBetweenSameUsersParameters = {
        timeWindow: {
          units: 1,
          granularity: 'hour',
        },
        transactionVolumeThreshold: {
          USD: 10000,
        },
      }
      return {
        id: 'R-126',
        type: 'TRANSACTION',
        name: 'High volume between same parties',
        description:
          'Same receiver and destination details are used for transactions in the amount of >= x in time t',
        descriptionTemplate:
          'Transaction volume {{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above their expected amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }} between two users in {{ format-time-window parameters.timeWindow }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        labels: [],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TransactionsRoundValuePercentageRuleParameters =
        {
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
          'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction.',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds with more than {{ parameters.patternPercentageLimit }}% of transactions as round values ending in 00.00 (hundreds without cents) within time {{ format-time-window parameters.timeWindow }}. Rule should hit after the user has initiaited {{ parameters.initialTransactions }} transactions (doesn't have to be successful)",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'transactions-round-value-percentage',
        labels: [],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: HighUnsuccessfullStateRateParameters = {
        transactionState: 'REFUNDED',
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
          "{{ if-sender 'Sender' 'Receiver' }} has more than {{ to-percent parameters.threshold }} of all transactions in a “{{ parameters.transactionState}}” state within {{ format-time-window parameters.timeWindow }}. The rule is activated after the user initiates {{ parameters.minimumTransactions }} number of transactions in total.",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'high-unsuccessfull-state-rate',
        labels: [],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
          transactionTypes: ['DEPOSIT'],
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
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: TooManyCounterpartyCountryRuleParameters = {
        timeWindow: {
          units: 1,
          granularity: 'hour',
        },
        transactionsLimit: 2,
        transactionTypes: ['DEPOSIT'],
        checkSender: 'all',
        checkReceiver: 'all',
      }
      return {
        id: 'R-123',
        type: 'TRANSACTION',
        name: 'Too Many Counterparty Country',
        description:
          'User is receiving or sending funds from >= X different countries in time t',
        descriptionTemplate:
          "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds from more than {{ parameters.transactionsLimit }} unique country within {{ format-time-window parameters.timeWindow }}",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'too-many-counterparty-country',
        labels: ['AML', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        labels: ['AML'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
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
        id: 'R-127',
        type: 'TRANSACTION',
        name: 'Same payment details used too many times',
        description: 'Same payment details used >= x times in unit time t',
        descriptionTemplate:
          'Same payment details used {{ numberOfUses }} times within {{ format-time-window parameters.timeWindow }}, which is more or equal than threshold of {{ parameters.threshold }}',
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'same-payment-details',
        labels: [],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
    () => {
      const defaultParameters: BlacklistPaymentdetailsRuleParameters = {
        blacklistedIBANPaymentDetails: [],
      }
      return {
        id: 'R-129',
        type: 'TRANSACTION',
        name: 'Blacklist payment details',
        description: 'Payment details are in the blacklist',
        descriptionTemplate:
          "{{ if-sender 'Sender’s' 'Receiver’s' }} payment details are in blacklisted payment details",
        defaultParameters,
        defaultAction: 'FLAG',
        ruleImplementationName: 'blacklist-payment-details',
        labels: ['AML', 'Risk Appetite', 'List'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
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
        labels: ['Internal Fraud', 'AML', 'Fraud'],
        defaultCasePriority: 'P1',
        defaultCaseCreationType: 'TRANSACTION',
      }
    },
  ]

export const TRANSACTION_RULES_LIBRARY: Array<Rule> =
  _TRANSACTION_RULES_LIBRARY.map((getRule) => {
    const rule = getRule()
    return {
      ...rule,
      parametersSchema:
        TRANSACTION_RULES[rule.ruleImplementationName].getSchema(),
    }
  })

export function getTransactionRuleByRuleId(ruleId: string): Rule {
  return TRANSACTION_RULES_LIBRARY.find((rule) => rule.id === ruleId) as Rule
}
