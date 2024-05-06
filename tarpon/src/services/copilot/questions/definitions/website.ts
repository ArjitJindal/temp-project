import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import { MerchantMonitoringScrapeService } from '@/services/merchant-monitoring/merchant-monitoring-scrape'
import { ensureHttps } from '@/utils/http'
import { summaryToProperties } from '@/services/copilot/questions/definitions/common/merchant-monitoring'

export const Website: PropertiesQuestion<{
  website: string
}> = {
  type: 'PROPERTIES',
  categories: ['BUSINESS'],
  questionId: COPILOT_QUESTIONS.WEBSITE,
  title: async (_, { website }) => {
    return `Business details from ${website}`
  },
  aggregationPipeline: async ({ tenantId, userId, username }, { website }) => {
    try {
      const mmss = await MerchantMonitoringScrapeService.init()
      const summaries = await mmss.getMerchantMonitoringSummaries(
        tenantId,
        userId ?? '',
        username,
        website
      )

      let summary = summaries.find(
        (s) =>
          s.source?.sourceType === 'SCRAPE' &&
          s.source.sourceValue &&
          ensureHttps(s.source.sourceValue) === ensureHttps(website)
      )
      if (!summary) {
        summary = await mmss.scrape(website)
      }
      if (!summary) {
        throw new Error('Could not get summary')
      }
      return {
        data: summaryToProperties(summary),
        summary: `The website ${website} describes ${username} as: \n"${summary.summary}"`,
      }
    } catch (e) {
      return {
        data: [],
        summary: '',
      }
    }
  },
  variableOptions: {
    website: 'STRING',
  },
  defaults: ({ user }) => {
    if (user?.type === 'BUSINESS') {
      return {
        website: user?.legalEntity?.contactDetails?.websites?.at(0) || '',
      }
    }
    return {
      website: user?.contactDetails?.websites?.at(0) || '',
    }
  },
}
