import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { prompt } from '@/utils/openai'
import { addSentryExtras } from '@/core/utils/context'
import { logger } from '@/core/logger'

const MAX_TOKEN_OUTPUT = 4096
const industries: string[] = [
  'Agriculture and Forestry',
  'Automotive',
  'Banking and Financial Services',
  'Biotechnology',
  'Construction',
  'Consumer Goods and Services',
  'Education',
  'Energy',
  'Entertainment and Leisure',
  'Food and Beverage',
  'Healthcare',
  'Information Technology',
  'Manufacturing',
  'Media and Communications',
  'Mining and Natural Resources',
  'Pharmaceuticals',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Transportation and Logistics',
  'Travel and Tourism',
  'Utilities',
  'Wholesale Trade',
  'Others',
]

const productTypes: string[] = [
  'Apparel',
  'Appliances',
  'Automobiles',
  'Books',
  'Chemicals',
  'Computers and Electronics',
  'Consumer Packaged Goods',
  'Cosmetics and Personal Care',
  'Food and Beverages',
  'Furniture',
  'Hardware and Building Materials',
  'Health and Wellness Products',
  'Housewares',
  'Industrial Equipment',
  'Jewelry',
  'Medical Devices',
  'Pharmaceuticals',
  'Software and Applications',
  'Sports and Recreation Equipment',
  'Toys and Games',
  'Transportation Equipment',
  'Others',
]

export class MerchantSummariser {
  public async summarise(
    source: MerchantMonitoringSourceType,
    content: string
  ): Promise<MerchantMonitoringSummary | undefined> {
    try {
      if (!content) {
        throw new Error('Unable to extract information from the given site')
      }
      const output = await prompt(
        [
          {
            role: 'assistant',
            content:
              'You are a business intelligence API that will retrieve key values about a business from unstructured data. The key values are industry, products sold, location, number of employees, revenue and an overall summary.',
          },
          {
            role: 'assistant',
            content: `You will output your findings in this JSON format:
{
  "industry": "Healthcare",
  "products": ["Medical Devices", "Pharmaceuticals"],
  "location": "Delhi, India",
  "employees": "54",
  "revenue": "$100000",
  "summary": "Acme is a textile company which sells shoes in Delhi, India and generates a revenue of $100000 with 54 employees"
}`,
          },
          {
            role: 'assistant',
            content: `Please choose the relevant industry from the following list: ${industries.join(
              ', '
            )}`,
          },
          {
            role: 'assistant',
            content: `Please choose the products sold from the following list: ${productTypes.join(
              ', '
            )}`,
          },
          {
            role: 'assistant',
            content: `Output the location one of the following formats "City, Country" or "Country"`,
          },
          {
            role: 'assistant',
            content: `Output the number of employees as a number range e.g. 1000-5000`,
          },
          {
            role: 'assistant',
            content: `Output the revenue as number range e.g. $1000-5000`,
          },
          {
            role: 'assistant',
            content: `If a value is unknown, please just say "Unspecified"`,
          },
          {
            role: 'assistant',
            content:
              `Please analyse the following content for a business:\n ${content}`.substring(
                0,
                MAX_TOKEN_OUTPUT
              ),
          },
        ],
        { response_format: { type: 'json_object' } }
      )

      const summary: {
        industry: string
        products: string[]
        location: string
        employees: string
        revenue: string
        summary: string
      } = JSON.parse(output)

      if (!summary) {
        addSentryExtras({ content, output })
        logger.error(`Unable to summarise ${source} content`)
        throw new Error('Unable to extract information from the given site')
      }

      return {
        source: { sourceType: source },
        industry: summary.industry,
        products: summary.products,
        location: summary.location,
        employees: summary.employees,
        revenue: summary.revenue,
        summary: summary.summary,
        raw: content,
      }
    } catch (e) {
      logger.error(e)
      throw e
    }
  }
}
