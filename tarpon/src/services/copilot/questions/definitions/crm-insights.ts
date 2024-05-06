import { BadRequest } from 'http-errors'
import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import { CrmService } from '@/services/crm'
export const CrmInsights: PropertiesQuestion<any> = {
  type: 'PROPERTIES',
  questionId: COPILOT_QUESTIONS.CRM_INSIGHTS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }) => {
    return `CRM insights for ${username}`
  },
  aggregationPipeline: async ({ user, tenantId }) => {
    const crmService = new CrmService(tenantId)
    const crmAccountId =
      user?.tags?.find((t) => t.key === 'crmAccountId')?.value ?? ''

    if (!crmAccountId) {
      throw new BadRequest('No CRM data attached')
    }
    const crmAccount = await crmService.getAccount(crmAccountId)

    return {
      data: [
        {
          key: 'CRM Summary',
          value: crmAccount?.summary.summary || '',
        },
        {
          key: 'Positive indicators',
          value: crmAccount?.summary.good || '',
        },
        {
          key: 'Neutral indicators',
          value: crmAccount?.summary.neutral || '',
        },
        {
          key: 'Negative indicators',
          value: crmAccount?.summary.bad || '',
        },
        {
          key: 'Sentiment score',
          value: crmAccount?.summary.sentiment.toFixed(0) || '',
        },
      ],
      summary: crmAccount?.summary.summary || '',
    }
  },
  variableOptions: {},
  defaults: () => {},
}
