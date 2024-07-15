import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { AIAttributeCategory } from '@/@types/openapi-internal/AIAttributeCategory'
import { AiSource } from '@/@types/openapi-internal/AiSource'

interface AIAttributeData {
  isPii: boolean
  category: AIAttributeCategory
}
const AI_SOURCES_MAP: { [key in AIAttribute]: AIAttributeData } = {
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
    category: 'CASE',
  },
  userComments: {
    isPii: false,
    category: 'USER',
  },
  caseGenerationDate: {
    isPii: false,
    category: 'CASE',
  },
  firstPaymentAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  transactionsCount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  minAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  maxAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  totalTransactionAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  averageTransactionAmount: {
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
  closureDate: {
    isPii: false,
    category: 'CASE',
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
