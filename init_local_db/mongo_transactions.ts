import { TransactionCaseManagement } from '../src/@types/openapi-internal/TransactionCaseManagement'

const sampleTransaction = {
  destinationAmountDetails: {
    country: 'PH' as const,
    transactionCurrency: 'PHP' as const,
    transactionAmount: 50,
  },
  productType: 'Payment link',
  transactionState: 'CREATED' as const,
  originAmountDetails: {
    country: 'PH' as const,
    transactionCurrency: 'PHP' as const,
    transactionAmount: 50,
  },
  timestamp: Date.now() - 3600 * 5,
  destinationPaymentDetails: {
    method: 'WALLET' as const,
    walletType: 'internal' as const,
    paymentChannel: 'nextpay',
  },
  originPaymentDetails: {
    method: 'CARD' as const,
  },
  hitRules: [],
  executedRules: [],
  status: 'ALLOW' as const,
}

const data: TransactionCaseManagement[] = []

for (let i = 0; i < 5; i += 1) {
  data.push({
    ...sampleTransaction,
    timestamp: sampleTransaction.timestamp + 3600 * i * 5,
    transactionId: `unhit_outgoing_${i}`,
    originUserId: 'originUserId_1',
    destinationUserId: 'originUserId_2',
    status: 'BLOCK',
  })
}

for (let i = 0; i < 40; i += 1) {
  data.push({
    ...sampleTransaction,
    timestamp: sampleTransaction.timestamp + 3600 * i,
    transactionId: `outgoing_${i}`,
    originUserId: 'originUserId_1',
    destinationUserId: 'originUserId_2',
    status: 'BLOCK',
    hitRules: [
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-69',
        ruleInstanceId: '69',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      },
    ],
    executedRules: [
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleHit: false,
        ruleId: 'R-69',
        ruleInstanceId: '69',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      },
    ],
  })
}

data.push({
  ...sampleTransaction,
  transactionId: `transaction-1`,
  timestamp: sampleTransaction.timestamp + 3601,
  originUserId: 'originUserId_2',
  destinationUserId: 'originUserId_1',
  status: 'BLOCK',
  hitRules: [
    {
      ruleName: 'Nothing to see here',
      ruleAction: 'ALLOW',
      ruleId: 'R-4',
      ruleInstanceId: '4',
      ruleDescription: 'No description',
    },
    {
      ruleName: 'Receiver is bad',
      ruleAction: 'FLAG',
      ruleId: 'R-2',
      ruleInstanceId: '2',
      ruleDescription: 'Receiver is bad',
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-10',
      ruleInstanceId: '10',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-1',
      ruleInstanceId: '1',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-3',
      ruleInstanceId: '3',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
    },
  ],
  executedRules: [
    {
      ruleName: 'Nothing to see here',
      ruleAction: 'ALLOW',
      ruleId: 'R-4',
      ruleInstanceId: '4',
      ruleDescription: 'No description',
      ruleHit: true,
    },
    {
      ruleName: 'Receiver is bad',
      ruleAction: 'FLAG',
      ruleId: 'R-2',
      ruleInstanceId: '2',
      ruleDescription: 'Receiver is bad',
      ruleHit: true,
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-10',
      ruleInstanceId: '10',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      ruleHit: true,
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-1',
      ruleInstanceId: '1',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      ruleHit: true,
    },
    {
      ruleName: 'High volume receiver in hours',
      ruleAction: 'BLOCK',
      ruleId: 'R-3',
      ruleInstanceId: '3',
      ruleDescription:
        'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      ruleHit: true,
    },
  ],
})

for (let i = 0; i < 40; i += 1) {
  data.push({
    ...sampleTransaction,
    transactionId: `incoming_${i}`,
    timestamp: sampleTransaction.timestamp + 3601 * i,
    originUserId: 'originUserId_2',
    destinationUserId: 'originUserId_1',
    status: 'BLOCK',
    hitRules: [
      {
        ruleName: 'Nothing to see here',
        ruleAction: 'ALLOW',
        ruleId: 'R-4',
        ruleInstanceId: '4',
        ruleDescription: 'No description',
      },
      {
        ruleName: 'Receiver is bad',
        ruleAction: 'FLAG',
        ruleId: 'R-2',
        ruleInstanceId: '2',
        ruleDescription: 'Receiver is bad',
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-10',
        ruleInstanceId: '10',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-1',
        ruleInstanceId: '1',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-3',
        ruleInstanceId: '3',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
      },
    ],
    executedRules: [
      {
        ruleName: 'Nothing to see here',
        ruleAction: 'ALLOW',
        ruleId: 'R-4',
        ruleInstanceId: '4',
        ruleDescription: 'No description',
        ruleHit: true,
      },
      {
        ruleName: 'Receiver is bad',
        ruleAction: 'FLAG',
        ruleId: 'R-2',
        ruleInstanceId: '2',
        ruleDescription: 'Receiver is bad',
        ruleHit: true,
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-10',
        ruleInstanceId: '10',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
        ruleHit: true,
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-1',
        ruleInstanceId: '1',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
        ruleHit: true,
      },
      {
        ruleName: 'High volume receiver in hours',
        ruleAction: 'BLOCK',
        ruleId: 'R-3',
        ruleInstanceId: '3',
        ruleDescription:
          'Receiver is receiving >= USD x or equivalent amount in total within time t hours',
        ruleHit: true,
      },
    ],
  })
}

export = data
