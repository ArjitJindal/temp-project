import { PropertiesQuestion } from '@/services/copilot/questions/types'
import { MerchantMonitoringScrapeService } from '@/services/merchant-monitoring/merchant-monitoring-scrape'
import { summaryToProperties } from '@/services/copilot/questions/definitions/transformers/merchant-monitoring'

export const Linkedin: PropertiesQuestion<{
  companyName: string
}> = {
  type: 'PROPERTIES',
  questionId: 'Linkedin',
  title: ({ username }) => {
    return `Details for ${username} from Linkedin`
  },
  aggregationPipeline: async (_, { companyName }) => {
    try {
      const mmss = await MerchantMonitoringScrapeService.init()
      const summary = await mmss.linkedin(companyName)
      if (!summary) {
        throw new Error('Could not get summary')
      }
      return {
        data: summaryToProperties(summary),
        summary: summary.summary || '',
      }
    } catch (e) {
      return {
        data: [],
        summary: '',
      }
    }
  },
  variableOptions: {
    companyName: 'STRING',
  },
  defaults: ({ username }) => {
    return {
      companyName: username,
    }
  },
}
