import { humanizeCamelCase } from '@flagright/lib/utils/humanize'
import { TransactionLogicVariable } from './types'

export const PNB_CUSTOM_TAGS_KEYS = [
  'agentCode',
  'branchCode',
  'destinationFundId',
  'policyNumber',
  'thirdPartyInvestment',
  'refTypeDescription',
  'thirdPartyICNumber',
  'guardianICNumber',
  'destinationProductType',
  'sourceSystem',
  'originatingSystem',
  'originProductType',
  'originFundId',
]
export const FIRST_DIGITAL_TAG_KEYS = ['elliptic_risk_score']

const getVariable = (
  key: string,
  tenantIds: string[]
): TransactionLogicVariable => ({
  key: `tags-${key}`,
  entity: 'TRANSACTION',
  valueType: 'string',
  uiDefinition: {
    label: `Tags - ${humanizeCamelCase(key)}`,
    type: 'text',
  },
  load: async (transaction) => {
    if (!transaction) {
      return null
    }
    const tags = transaction.tags
    if (!tags) {
      return null
    }

    const tag = tags.find((tag) => tag.key === key)

    return tag?.value
  },
  sourceField: 'tags',
  requiredFeatures: tenantIds.includes('pnb') ? ['PNB'] : undefined,
  tenantIds: tenantIds.concat(['flagright']),
})

export const PNB_CUSTOM_TAGS_KEYS_VARIABLES = PNB_CUSTOM_TAGS_KEYS.map((key) =>
  getVariable(key, ['pnb', 'pnb-stress'])
)
export const FIRST_DIGITAL_CUSTOM_TAGS_KEYS_VARIABLES =
  FIRST_DIGITAL_TAG_KEYS.map((key) => getVariable(key, ['0ee355b0a1']))
