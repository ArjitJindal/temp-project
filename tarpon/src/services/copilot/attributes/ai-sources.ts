import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { AIAttributeCategory } from '@/@types/openapi-internal/AIAttributeCategory'
import { AiSource } from '@/@types/openapi-internal/AiSource'

interface AIAttributeData {
  isPii: boolean
  category: AIAttributeCategory
}
const AI_SOURCES_MAP: Record<AIAttribute, AIAttributeData> = {
  userType: {
    isPii: false,
    category: 'USER',
  },
  country: {
    isPii: false,
    category: 'TRANSACTION',
  },
  reasons: {
    isPii: false,
    category: 'CASE',
  },
  caseComments: {
    isPii: false,
    category: 'CASE',
  },
  alertComments: {
    isPii: false,
    category: 'ALERT',
  },
  userComments: {
    isPii: false,
    category: 'USER',
  },
  caseGenerationDate: {
    isPii: false,
    category: 'CASE',
  },
  alertGenerationDate: {
    isPii: false,
    category: 'ALERT',
  },
  firstPaymentAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  transactionsCount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  minOriginAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  minDestinationAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  maxOriginAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  maxDestinationAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  totalOriginAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  totalDestinationAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  averageOriginAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  averageDestinationAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  name: {
    isPii: true,
    category: 'USER',
  },
  websites: {
    isPii: false,
    category: 'USER',
  },
  caseActionDate: {
    isPii: false,
    category: 'CASE',
  },
  alertActionDate: {
    isPii: false,
    category: 'ALERT',
  },
  industry: {
    isPii: false,
    category: 'USER',
  },
  productsSold: {
    isPii: false,
    category: 'USER',
  },
  transactionIds: {
    isPii: false,
    category: 'TRANSACTION',
  },
  rules: {
    isPii: false,
    category: 'CASE',
  },
  ruleHitNames: {
    isPii: false,
    category: 'ALERT',
  },
  ruleHitDescriptions: {
    isPii: false,
    category: 'ALERT',
  },
  originUserName: {
    isPii: true,
    category: 'TRANSACTION',
  },
  destinationUserName: {
    isPii: true,
    category: 'TRANSACTION',
  },
  originTransactionAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  destinationTransactionAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  originTransactionCurrency: {
    isPii: false,
    category: 'TRANSACTION',
  },
  destinationTransactionCurrency: {
    isPii: false,
    category: 'TRANSACTION',
  },
  originPaymentDetails: {
    isPii: false,
    category: 'TRANSACTION',
  },
  destinationPaymentDetails: {
    isPii: false,
    category: 'TRANSACTION',
  },
  originTransactionCountry: {
    isPii: false,
    category: 'TRANSACTION',
  },
  destinationTransactionCountry: {
    isPii: false,
    category: 'TRANSACTION',
  },
  timeOfTransaction: {
    isPii: false,
    category: 'TRANSACTION',
  },
  transactionReference: {
    isPii: false,
    category: 'TRANSACTION',
  },
  sanctionsHitDetails: {
    isPii: false,
    category: 'ALERT',
  },
}

export const AI_SOURCES: AiSource[] = Object.entries(AI_SOURCES_MAP).map(
  ([key, value]) => {
    return {
      sourceName: key as AIAttribute,
      isPii: value.isPii,
      category: value.category,
    }
  }
)
