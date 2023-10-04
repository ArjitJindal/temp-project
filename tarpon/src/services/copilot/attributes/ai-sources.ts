import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { AIAttributeCategory } from '@/@types/openapi-internal/AIAttributeCategory'
import { AiSource } from '@/@types/openapi-internal/AiSource'

interface AIAttributeData {
  isPii: boolean
  category: AIAttributeCategory
}
const AI_SOURCES_MAP: { [key in AIAttribute]: AIAttributeData } = {
  averageTransactionAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  country: {
    isPii: false,
    category: 'TRANSACTION',
  },
  firstPaymentAmount: {
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
  transactionsCount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  transactionIds: {
    isPii: false,
    category: 'TRANSACTION',
  },
  totalTransactionAmount: {
    isPii: false,
    category: 'TRANSACTION',
  },
  name: {
    isPii: true,
    category: 'USER',
  },
  industry: {
    isPii: false,
    category: 'USER',
  },
  productsSold: {
    isPii: false,
    category: 'USER',
  },
  userType: {
    isPii: false,
    category: 'USER',
  },
  userComments: {
    isPii: false,
    category: 'USER',
  },
  websites: {
    isPii: false,
    category: 'USER',
  },
  alertComments: {
    isPii: false,
    category: 'CASE',
  },
  caseComments: {
    isPii: false,
    category: 'CASE',
  },
  caseGenerationDate: {
    isPii: false,
    category: 'CASE',
  },
  closureDate: {
    isPii: false,
    category: 'CASE',
  },
  ruleHitNames: {
    isPii: false,
    category: 'CASE',
  },
  ruleHitNature: {
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
