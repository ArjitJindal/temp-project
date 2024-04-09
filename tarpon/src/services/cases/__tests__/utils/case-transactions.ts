import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const CASE_TRANSACTIONS: InternalTransaction[] = [
  {
    destinationAmountDetails: {
      country: 'DE',
      transactionCurrency: 'EUR',
      transactionAmount: 113910,
    },
    transactionState: 'CREATED',
    originAmountDetails: {
      country: 'US',
      transactionCurrency: 'USD',
      transactionAmount: 123310,
    },
    timestamp: 1676324648000,
    promotionCodeUsed: true,
    transactionId: 'T-1',
    originUserId: '2',
    destinationUserId: 'U-23',
    destinationPaymentDetails: {
      bankName: 'HyperVereins Bank',
      method: 'GENERIC_BANK_ACCOUNT',
    },
    originPaymentDetails: {
      walletType: '4hhye912dasdkc',
      method: 'WALLET',
    },
    status: 'FLAG',
    hitRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Transactions exceed past period',
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
        labels: [],
      },
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Transaction amount too high',
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'Transaction amount is >= x in USD or equivalent',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
        labels: [],
      },
    ],
    executedRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'First payment of a Customer',
        ruleHit: false,
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'First transaction of a user',
        labels: [],
      },
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Too many rounded transactions',
        ruleHit: false,
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction.',
        labels: [],
      },
    ],
    type: 'REFUND',
  },
  {
    destinationAmountDetails: {
      country: 'DE',
      transactionCurrency: 'EUR',
      transactionAmount: 113910,
    },
    transactionState: 'CREATED',
    originAmountDetails: {
      country: 'US',
      transactionCurrency: 'USD',
      transactionAmount: 123310,
    },
    timestamp: 1676324648000,
    transactionId: 'T-2',
    originUserId: '1',
    destinationUserId: '2',
    destinationPaymentDetails: {
      bankName: 'HyperVereins Bank',
      method: 'GENERIC_BANK_ACCOUNT',
    },
    originPaymentDetails: {
      walletType: '4hhye912dasdkc',
      method: 'WALLET',
    },
    status: 'FLAG',
    hitRules: [
      {
        ruleName: 'Transactions exceed past period',
        ruleAction: 'FLAG',
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
      },
    ],
    executedRules: [
      {
        ruleName: 'First payment of a Customer',
        ruleAction: 'FLAG',
        ruleHit: false,
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'First transaction of a user',
      },
      {
        ruleAction: 'FLAG',
        ruleName: 'Transactions exceed past period',
        ruleHit: true,
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
      },
    ],
    type: 'REFUND',
  },
  {
    destinationAmountDetails: {
      country: 'DE',
      transactionCurrency: 'EUR',
      transactionAmount: 113910,
    },
    transactionState: 'CREATED',
    originAmountDetails: {
      country: 'US',
      transactionCurrency: 'USD',
      transactionAmount: 123310,
    },
    timestamp: 1676324648000,
    transactionId: 'T-3',
    originUserId: '1',
    destinationUserId: '2',
    destinationPaymentDetails: {
      bankName: 'HyperVereins Bank',
      method: 'GENERIC_BANK_ACCOUNT',
    },
    originPaymentDetails: {
      walletType: '4hhye912dasdkc',
      method: 'WALLET',
    },
    status: 'FLAG',
    hitRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Transaction amount too high asdfasdf',
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'Transaction amount is >= x in USD or equivalent',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
        labels: [],
      },
    ],
    executedRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'First payment of a Customer',
        ruleHit: false,
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'First transaction of a user',
        labels: [],
      },
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Transactions exceed past period',
        ruleHit: true,
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
        labels: [],
      },
    ],
    type: 'REFUND',
  },
  {
    destinationAmountDetails: {
      country: 'DE',
      transactionCurrency: 'EUR',
      transactionAmount: 113910,
    },
    transactionState: 'CREATED',
    originAmountDetails: {
      country: 'US',
      transactionCurrency: 'USD',
      transactionAmount: 123310,
    },
    timestamp: 1680719046000,
    transactionId: 'T-4',
    originUserId: '2',
    destinationUserId: 'U-23',
    destinationPaymentDetails: {
      bankName: 'HyperVereins Bank',
      method: 'GENERIC_BANK_ACCOUNT',
    },
    originPaymentDetails: {
      walletType: '4hhye912dasdkc',
      method: 'WALLET',
    },
    status: 'FLAG',
    hitRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Transactions exceed past period',
        ruleInstanceId: 'rid-77',
        ruleId: 'R-77',
        ruleDescription:
          'Total number of transactions in the last time period t1 is >= X times higher than total number of transactions in time period t2',
        ruleHitMeta: {
          hitDirections: ['ORIGIN', 'DESTINATION'],
        },
        labels: [],
      },
    ],
    executedRules: [
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'First payment of a Customer',
        ruleHit: false,
        ruleInstanceId: 'rid-2',
        ruleId: 'R-2',
        ruleDescription: 'First transaction of a user',
        labels: [],
      },
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Too many rounded transactions',
        ruleHit: false,
        ruleInstanceId: 'rid-131',
        ruleId: 'R-131',
        ruleDescription:
          'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction.',
        labels: [],
      },
      {
        ruleAction: 'FLAG',
        nature: 'AML',
        ruleName: 'Too many rounded transactions',
        ruleHit: false,
        ruleInstanceId: 'rid-77',
        ruleId: 'R-77',
        ruleDescription:
          'Same user ID receives or sends >= X % of all of their receiving or sending transactions as round values ending in 00.00 (hundreds without cents) in time t. The rule kicks in after user has y transactions for any specific direction.',
        labels: [],
      },
    ],

    type: 'REFUND',
  },
]
