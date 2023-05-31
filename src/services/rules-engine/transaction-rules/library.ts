/**
 * This file is the source of truth of all our rules.
 * We'll deploy the rules defined here automatically during the deployment process.
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1xAl3cqF6cGMyFTpiIOXguyq7P_EGlTldbOWCYj0lMA8
 */

import { PaymentMethodRuleFilterParameter } from '../transaction-filters/payment-method'
import { TransactionFilters, UserFilters } from '../filters'
import { USER_RULES, UserRuleImplementationName } from '../user-rules'
import { SanctionsBusinessUserRuleParameters } from '../user-rules/sanctions-business-user'
import { SanctionsBankUserRuleParameters } from '../user-rules/sanctions-bank-name'
import { SanctionsConsumerUserRuleParameters } from '../user-rules/sanctions-consumer-user'
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
import { TransactionsOutflowInflowVolumeRuleParameters } from './transactions-outflow-inflow-volume'
import { SanctionsCounterPartyRuleParameters } from './sanctions-counterparty'
import { TRANSACTION_RULES, TransactionRuleImplementationName } from './index'
import { Rule } from '@/@types/openapi-internal/Rule'
import { HighUnsuccessfullStateRateParameters } from '@/services/rules-engine/transaction-rules/high-unsuccessfull-state-rate'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-amount-exceeded'
import { TransactionsAverageNumberExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-number-exceeded'
import { SamePaymentDetailsParameters } from '@/services/rules-engine/transaction-rules/same-payment-details'
import { BlacklistTransactionMatchedFieldRuleParameters } from '@/services/rules-engine/transaction-rules/blacklist-transaction-related-value'
import { MerchantMonitoringIndustryUserRuleParameters } from '@/services/rules-engine/user-rules/merchant-monitoring-industry'
import { MachineLearningGenericModelParameters } from '@/services/rules-engine/transaction-rules/machine-learning-generic-model'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'

export const DEFAULT_CURRENCY_KEYWORD = '__DEFAULT_CURRENCY__'

const _RULES_LIBRARY: Array<
  () => Omit<Rule, 'parametersSchema' | 'ruleImplementationName'> & {
    ruleImplementationName:
      | TransactionRuleImplementationName
      | UserRuleImplementationName
  }
> = [
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
    labels: [],
    defaultNature: 'AML',
    defaultCasePriority: 'P1',
    typology: 'Account activity, inconsistent with customer profile',
    typologyGroup: 'Unusual Behaviour',
    typologyDescription:
      'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
    source:
      'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      typology: 'Account activity, inconsistent with customer profile',
      typologyGroup: 'Unusual Behavior',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Account activity, inconsistent with customer profile ',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Account activity, inconsistent with customer profile',
      typologyGroup: 'Unusual Behavior',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Account activity, inconsistent with customer profile or Initial account was opened by a money mule ',
      typologyGroup: 'Money Mules Unusual Behavior',
      typologyDescription:
        'UK National risk assessment of money laundering and terrorist financing 2021',
      source:
        '1) UK National risk assessment of money laundering and terrorist financing 2020 Guidelines to 2) MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Account activity, inconsistent with customer profile',
      typologyGroup: 'Unusual Behavior',
      typologyDescription:
        "The customer uses a currency that does not fit with their profile or what is known about the customer's business.",
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      name: 'Too many inbound transactions under reporting limit',
      description:
        '>= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'low-value-incoming-transactions',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Avoiding reporting limits',
      typologyGroup: 'Structuring',
      typologyDescription:
        'Conceal or disguise significant transactions to avoid disclosure for record purposes by executing frequent or several transactions such that each transaction by itself is below reporting thresholds',
      source:
        '1) Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism 2) AUSTRAC:Stored value cards: money laundering and terrorism financing risk assessment 2017',
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
      name: 'Too many outbound transactions under reporting limit',
      description:
        '>= x number of low value outgoing transaction(s) just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.',
      descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transaction(s) just under the flagging limit`,
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'low-value-outgoing-transactions',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: '',
      typologyGroup: '',
      typologyDescription: '',
      source: '',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Hidden / Unusual Relationships, Money Mules, Scams, Terrorist Financing',
      typologyGroup:
        'Hidden / Unusual Relationships, Money Mules, Scams (Romance, Nigerian Price, Inheritance and etc.), Terrorist Financing',
      typologyDescription:
        'Typologies identifying entities with shared connections or which may signify attempts to disguise or hide relationships. Money Muling activity of wittingly or unwittingly performing a transaction for the benefit of 3rd parties to disguise the true source of funds.',
      source:
        '1) UK National risk assessment of money laundering and terrorist financing 2021 2) Singapore. Stored value cards: money laundering and terrorism financing risk assessment 2017',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Hidden / Unusual Relationships, Money Mules, Scams, Terrorist Financing',
      typologyGroup:
        'Hidden / Unusual Relationships, Money Mules, Scams (Romance, Nigerian Price, Inheritance and etc.), Terrorist Financing',
      typologyDescription:
        'Typologies identifying entities with shared connections or which may signify attempts to disguise or hide relationships. Money Muling activity of wittingly or unwittingly performing a transaction for the benefit of 3rd parties to disguise the true source of funds.',
      source:
        '1) UK National risk assessment of money laundering and terrorist financing 2021 2) Singapore. Stored value cards: money laundering and terrorism financing risk assessment 2017',
    }
  },
  () => {
    const defaultParameters: MerchantReceiverNameRuleParameters = {
      merchantNames: [],
    }
    const defaultFilters: TransactionFilters = {
      paymentMethods: ['WALLET'],
    }
    return {
      id: 'R-13',
      type: 'TRANSACTION',
      name: 'Blacklisted Merchant receiver name',
      description: 'Merchant name is in the blacklist',
      descriptionTemplate: '{{ receiverName }} is blacklisted',
      defaultParameters,
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'merchant-receiver-name',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Prohibited merchants due to financial crime risks',
      typologyGroup: 'Internal Blacklists',
      typologyDescription:
        'Blocking transactions with certain merchants which are outside of risk appetite of the organization',
      source: 'Prohibited countries policy, Sanctions Policy',
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
    const defaultFilters: PaymentMethodRuleFilterParameter = {
      paymentMethods: ['CARD'],
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Prohibited countries of cards issued due to financial crime risks',
      typologyGroup: 'Internal Blacklists',
      typologyDescription:
        'Blocking transactions with certain card issued in countries which are outside of risk appetite of the organization',
      source: 'Prohibited countries policy, Sanctions Policy',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Transactions with high-risk industries, potentially sanctioned entities, for potentially illicit purposes',
      typologyGroup: 'Internal Blacklists',
      typologyDescription:
        "Identifying risky transactions by screening the reference field which might be outside of firm's risk appetite",
      source:
        'Prohibited countries policy, Prohibited industries Policy, Sanctions Policy',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Money Mules, Acquiring Fraud, Layering of funds',
      typologyGroup: 'Money Mules, Acquiring Fraud, Layering',
      typologyDescription:
        'Money Muling activity of wittingly or unwittingly performing a transaction for the benefit of 3rd parties to disguise the true source of funds. Acquiring fraud - receiving money that are proceeds of fraud ( typically top-up from stolen card and/or APP fraud). Layering - disguising the true nature of transactions via numerous transfers between financial institutions.',
      source:
        'UK National risk assessment of money laundering and terrorist financing 2020',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Money Mules, Account take over',
      typologyGroup:
        'Hidden / Unusual Relationships, Money Mules, Account Takeover Fraud',
      typologyDescription:
        'Use of different accounts opened in one institution by a perpetrator in order to perform the illicit activity. The same IP can be indicative of an account takeover attack, connected money mules, or money launderers.',
      source: 'NA',
    }
  },
  () => {
    const defaultParameters: TooManyUsersForSameCardParameters = {
      uniqueUsersCountThreshold: 10,
      timeWindowInDays: 1,
    }
    const defaultFilters: TransactionFilters = {
      paymentMethods: ['CARD'],
    }
    return {
      id: 'R-53',
      type: 'TRANSACTION',
      name: 'Same card used by too many users',
      description: 'Same card used by  >= x unique user IDs',
      descriptionTemplate:
        'Same card ({{ cardFingerprint }}) used by {{ uniqueUserCount }} unique users',
      defaultParameters,
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'too-many-users-for-same-card',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Acquiring Fraud',
      typologyGroup: 'Card Fraud',
      typologyDescription:
        'Attempts to use a stolen card to perform a purchase/top-up wallet',
      source: 'Card Scheme Rules',
    }
  },
  () => {
    const defaultParameters: SameUserUsingTooManyCardsParameters = {
      uniqueCardsCountThreshold: 10,
      timeWindowInDays: 1,
    }
    const defaultFilters: TransactionFilters = {
      paymentMethods: ['CARD'],
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
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'same-user-using-too-many-cards',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Acquiring Fraud',
      typologyGroup: 'Card Fraud',
      typologyDescription:
        'Attempts to use a multiple stolen cards to perform a purchase/top-up wallet',
      source: 'Card Scheme Rules',
    }
  },
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      typology:
        'Customer activity is not in line with profile based on available information',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source: 'NA',
    }
  },
  () => {
    const defaultParameters: TransactionAmountRuleParameters = {
      transactionAmountThreshold: {
        [DEFAULT_CURRENCY_KEYWORD]: 10000,
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Objective transaction reporting',
      typologyGroup: 'Objective transaction reporting',
      typologyDescription:
        'Objective reporting required by AML Laws and regulations for transactions meeting certain criteria',
      source: 'Local laws and regulations',
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
        "\"IP address where the payment is initiated is outside the following expected location's for the user: user's country of residence, user's nationality country, user's previously approved transaction countries\n\nPreviously approved mean if this rule was hit and it's unsuspended on Console, log that country that was approved and add it to the whitelisted country\"",
      descriptionTemplate:
        "{{ if-sender 'Sender’s' 'Receiver’s' }} ip-bases country ({{ format-country ipCountry }}) is not country of origin ({{ format-country hitParty.user.userDetails.countryOfResidence }}) or country of nationality ({{ format-country hitParty.user.userDetails.countryOfNationality }})",
      defaultParameters: {},
      defaultFilters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'ip-address-unexpected-location',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Account Takeover Fraud',
      typologyGroup: 'Account Takeover Fraud',
      typologyDescription:
        'Access to account is compromised by a perpetrator and accessed from different IP in order to steal the funds',
      source: 'Japan Reference Cases on Suspicious Transactions 2020',
    }
  },
  () => {
    return {
      id: 'R-99',
      type: 'TRANSACTION',
      name: 'Transaction value exceeds expected limit',
      description:
        'For a given user, compares the expected transaction count or transaction amount per payment method or in aggregate for multiple time intervals.',
      descriptionTemplate: '{{ hitDescription }}',
      defaultParameters: {},
      defaultAction: 'FLAG',
      ruleImplementationName: 'user-transaction-limits',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      typology: '',
      typologyGroup: '',
      typologyDescription: '',
      source: '',
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
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Account Takeover Fraud',
      typologyGroup: 'Account takeover',
      typologyDescription:
        'Access to account is compromised by a perpetrator and accessed from different IP in order to steal the funds',
      source: 'Card Scheme Rules',
    }
  },
  () => {
    const defaultParameters: CardIssuedCountryRuleParameters = {
      allowedCountries: [],
    }
    const defaultFilters: TransactionFilters = {
      paymentMethods: ['CARD'],
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
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology:
        'Transactions with high-risk industries, potentially sanctioned entities, for potentially illicit purposes',
      typologyGroup: 'Internal Blacklists',
      typologyDescription:
        "Identifying risky transactions by screening the reference field which might be outside of firm's risk appetite",
      source:
        'Prohibited countries policy, Prohibited industries Policy, Sanctions Policy',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Avoiding reporting limits',
      typologyGroup: 'Structuring',
      typologyDescription:
        'Conceal or disguise significant transactions to avoid disclosure for record purposes by executing frequent or several transactions such that each transaction by itself is below reporting thresholds',
      source:
        '1) Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism 2) AUSTRAC:Stored value cards: money laundering and terrorism financing risk assessment 2017',
    }
  },
  () => {
    const defaultParameters: CardHolderNameRuleParameter = {
      allowedDistancePercentage: 30,
    }
    const defaultFilters: TransactionFilters | UserFilters = {
      paymentMethods: ['CARD'],
      userType: 'CONSUMER',
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
      defaultFilters,
      ruleImplementationName: 'card-holder-name-levensthein-distance',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Acquiring Fraud',
      typologyGroup: 'Card Fraud',
      typologyDescription:
        'Attempts to use multiple stolen cards to perform a purchase/top-up wallet',
      source: 'Card Scheme Rules',
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'A high value of transactions between the same parties can be indicative of ML',
      typologyGroup: 'Hidden / Unusual Relationships',
      typologyDescription:
        'Typologies identifying entities with shared connections or which may signify attempts to disguise or hide relationships.',
      source:
        'UK National risk assessment of money laundering and terrorist financing 2020',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology:
        'Change in behavior driven by an increase in a number of transactions',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
        currency: DEFAULT_CURRENCY_KEYWORD,
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      typology:
        'Change in behavior driven by an increase in a value of transactions',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      name: 'High volume between same parties',
      description:
        'Same receiver and destination details are used for transactions in the amount of >= x in time t',
      descriptionTemplate:
        'Transaction volume {{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above their expected amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }} between two users in {{ format-time-window parameters.timeWindow }}',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'high-traffic-volume-between-same-users',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      defaultFalsePositiveCheckEnabled: true,
      typology:
        'A high value of transactions between the same parties which can be indicative of ML ',
      typologyGroup: 'Hidden / Unusual Relationships',
      typologyDescription:
        'Typologies identifying entities with shared connections or which may signify attempts to disguise or hide relationships.',
      source:
        'UK National risk assessment of money laundering and terrorist financing 2020',
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
        'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction.',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds with more than {{ parameters.patternPercentageLimit }}% of transactions as round values ending in 00.00 (hundreds without cents) within time {{ format-time-window parameters.timeWindow }}. Rule should hit after the user has initiaited {{ parameters.initialTransactions }} transactions (doesn't have to be successful)",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-round-value-percentage',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology:
        'Transactions in round amounts  which disguise the true nature of transaction and might be indicative of ML/TF',
      typologyGroup: 'Structuring Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer. Conceal or disguise the true nature of transactions  by executing frequent or several transactions such that each transaction is a rounded number which is not common for regular payment activity',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology: 'Acquiring Fraud, Issuing Fraud, Account takeover fraud',
      typologyGroup: 'Card Fraud',
      typologyDescription: 'Unsuccessful attempts to use cards by fraudsters',
      source: 'Card Scheme Rules',
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Elevated ML/TF risks associated with transactions with high risk geography',
      typologyGroup: 'High Risk Transactions',
      typologyDescription:
        'Typologies that scrutinise a high-risk element of the transaction, such as geographic location or an attribute of the beneficiary or originator.',
      source:
        '1) FATF Emerging Terrorist Financing Risks 2) US Advisory on Human Rights Abuses Enabled by Corrupt Senior Foreign Political Figures and their Financial Facilitators',
    }
  },
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
      name: 'Too Many Counterparty Country',
      description:
        'User is receiving or sending funds from >= X different countries in time t',
      descriptionTemplate:
        "{{ if-sender 'Sender' 'Receiver' }} is {{ if-sender 'sending' 'receiving' }} funds from more than {{ parameters.transactionsLimit }} unique country within {{ format-time-window parameters.timeWindow }}",
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'too-many-counterparty-country',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Unusually high number of countries involved into transactional activity of the customer',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      typology:
        'Transactions in round amounts which disguise the true nature of transaction and might be indicative of ML/TF',
      typologyGroup: 'Structuring Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer. Conceal or disguise the true nature of transactions  by executing frequent or several transactions such that each transaction is a rounded number which is not common for regular payment activity',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology:
        'A high value of transactions using the same payment details can be indicative of ML',
      typologyGroup: 'Hidden / Unusual Relationships',
      typologyDescription:
        'Typologies identifying entities with shared connections or which may signify attempts to disguise or hide relationships.',
      source:
        'UK National risk assessment of money laundering and terrorist financing 2020',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Prohibited payment details due to financial crime risks',
      typologyGroup: 'Internal Blacklists',
      typologyDescription:
        'Blocking transactions with certain cards issued in countries which are outside of risk appetite of the organization',
      source: 'Prohibited countries policy, Sanctions Policy',
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
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Account activity, inconsistent with customer profile ',
      typologyGroup: 'Unusual Behaviour',
      typologyDescription:
        'Typologies that identify transactional activity characteristics that are unexpected or uncommon for a customer.',
      source:
        'Guidelines to MAS Notice PS-N01 On Prevention of Money Laundering and Countering the Financing of Terrorism',
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
        '{{ value }} is blacklisted in Blacklist ID {{ blackListId }} for {{ variableType }} field.',
      defaultParameters,
      defaultAction: 'BLOCK',
      ruleImplementationName: 'blacklist-transaction-related-value',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P3',
      typology: 'Internal Blacklists',
      typologyGroup: 'Internal Blacklists',
      typologyDescription: 'Internal Blacklists',
      source: 'Internal Blacklists',
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
      name: 'Transaction outflow and inflow pattern',
      type: 'TRANSACTION',
      description:
        'Compare transaction outflow volume with transaction inflow volume.',
      descriptionTemplate:
        'Transaction outflow volume ({{ format-money outflowAmount }}) is {{ format-comparator parameters.outflowInflowComparator }} transaction inflow volume ({{ format-money inflowAmount }})',
      defaultParameters,
      defaultAction: 'FLAG',
      ruleImplementationName: 'transactions-outflow-inflow-volume',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      typology: 'Money transit, Money Mules',
      typologyGroup: 'Layering, Money Mules',
      typologyDescription:
        'Money Muling activity of wittingly or unwittingly performing a transaction for the benefit of 3rd parties to disguise the true source of funds. Layering - disguising the true nature of transactions via numerous transfers between financial institutions.',
      source:
        'UK National risk assessment of money laundering and terrorist financing 2020',
    }
  },
  () => {
    const defaultParameters: SanctionsBusinessUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
    }

    return {
      id: 'R-128',
      name: 'Screening on Business legal entity & shareholders & directors',
      type: 'USER',
      description:
        'Sanctions/PEP/Adverse media screening on Business legal entity & shareholders & directors',
      descriptionTemplate:
        'Sanctions/PEP/Adverse media screening on Business legal entity & shareholders & directors',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-business-user',
      labels: [],
      defaultNature: 'SCREENING',
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
    }
  },
  () => {
    const defaultParameters: SanctionsBankUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
    }

    return {
      id: 'R-32',
      name: 'Screening on Bank name',
      type: 'USER',
      description:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
      descriptionTemplate:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-bank-name',
      labels: [],
      defaultNature: 'SCREENING',
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
    }
  },
  () => {
    const defaultParameters: SanctionsCounterPartyRuleParameters = {
      fuzziness: 20,
    }

    return {
      id: 'R-169',
      name: 'Sanctions transactions counterparty',
      type: 'TRANSACTION',
      description:
        'Sanctions/PEP/Adverse media screening on transaction counterparty.',
      descriptionTemplate:
        'Sanctions/PEP/Adverse media screening on transaction counterparty.',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-counterparty',
      labels: [],
      defaultNature: 'SCREENING',
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
      isOngoingScreening: true,
    }
  },
  () => {
    const defaultParameters: SanctionsConsumerUserRuleParameters = {
      fuzziness: 20,
      ongoingScreening: false,
    }

    return {
      id: 'R-16',
      name: 'Screening on Consumer users',
      type: 'USER',
      description: 'Sanctions/PEP/Adverse media screening on Consumer users.',
      descriptionTemplate:
        'Sanctions/PEP/Adverse media screening on Consumer users.',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'sanctions-consumer-user',
      labels: [],
      defaultNature: 'SCREENING',
      defaultCasePriority: 'P1',
      requiredFeatures: ['SANCTIONS'],
    }
  },
  () => {
    const defaultParameters: MachineLearningGenericModelParameters = {
      confidenceScore: 80,
    }

    return {
      id: 'R-100',
      name: 'ML Model for Fraud (generic)',
      type: 'TRANSACTION',
      description:
        'Generic machine learning model trained to recognize generic fraud pattern',
      descriptionTemplate: 'Potentially fraudulent pattern',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'machine-learning-generic-model',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      requiredFeatures: ['MACHINE_LEARNING_DEMO'],
    }
  },
  () => {
    const defaultParameters: MachineLearningGenericModelParameters = {
      confidenceScore: 80,
    }

    return {
      id: 'R-101',
      name: 'ML Model for Credit Card Fraud',
      type: 'TRANSACTION',
      description:
        'Machine learning model trained to recognize credit card fraud',
      descriptionTemplate: 'Potentially fraudulent pattern',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'machine-learning-credit-card-model',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      requiredFeatures: ['MACHINE_LEARNING_DEMO'],
    }
  },
  () => {
    const defaultParameters: MachineLearningGenericModelParameters = {
      confidenceScore: 80,
    }

    return {
      id: 'R-102',
      name: 'ML Model for ACH Chargeback Fraud',
      type: 'TRANSACTION',
      description:
        'Machine learning model trained to recognize ACH Chargeback fraud',
      descriptionTemplate: 'Potentially fraudulent pattern',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'machine-learning-ach-chargeback-model',
      labels: [],
      defaultNature: 'FRAUD',
      defaultCasePriority: 'P1',
      requiredFeatures: ['MACHINE_LEARNING_DEMO'],
    }
  },
  () => {
    const defaultParameters: MachineLearningGenericModelParameters = {
      confidenceScore: 80,
    }

    return {
      id: 'R-103',
      name: 'ML Model for Anomaly detection',
      type: 'TRANSACTION',
      description: 'Anomaly detection model to detect suspicious activity',
      descriptionTemplate: 'Potentially fraudulent pattern',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'machine-learning-anomaly-detection-model',
      labels: [],
      defaultNature: 'AML',
      defaultCasePriority: 'P1',
      requiredFeatures: ['MACHINE_LEARNING_DEMO'],
    }
  },
  () => {
    const defaultParameters: MerchantMonitoringIndustryUserRuleParameters = {
      sourceType: MERCHANT_MONITORING_SOURCE_TYPES,
    }

    return {
      id: 'R-17',
      name: 'Inconsistent business industry',
      type: 'USER',
      description: 'Business industry for user has changed.',
      descriptionTemplate: 'Business industry for user has changed.',
      defaultParameters,
      defaultAction: 'SUSPEND',
      ruleImplementationName: 'merchant-monitoring-industry',
      labels: [],
      defaultNature: 'SCREENING',
      defaultCasePriority: 'P1',
      requiredFeatures: ['MACHINE_LEARNING_DEMO'],
    }
  },
]

export const RULES_LIBRARY: Array<Rule> = _RULES_LIBRARY.map((getRule) => {
  const rule = getRule()
  return {
    ...rule,
    parametersSchema:
      rule.type === 'TRANSACTION'
        ? TRANSACTION_RULES[rule.ruleImplementationName]?.getSchema()
        : USER_RULES[rule.ruleImplementationName]?.getSchema(),
  }
})

export function getRuleByRuleId(ruleId: string): Rule {
  return RULES_LIBRARY.find((rule) => rule.id === ruleId) as Rule
}
