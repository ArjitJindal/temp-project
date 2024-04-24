import axios, { AxiosRequestConfig, AxiosInstance } from 'axios'
import { convert } from 'html-to-text'
import { InternalServerError } from 'http-errors'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { getSecretByName } from '@/utils/secrets-manager'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MerchantRepository } from '@/services/merchant-monitoring/merchant-repository'
import { logger } from '@/core/logger'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { traceable } from '@/core/xray'
import { prompt } from '@/utils/openai'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'
import { ensureHttps } from '@/utils/http'
import { apiFetch } from '@/utils/api-fetch'
import { updateLogMetadata } from '@/core/utils/context'

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

const MAX_TOKEN_OUTPUT = 4096

const OUTPUT_REGEX =
  /Industry:(.*)\nProducts:(.*)\nLocation:(.*)\nEmployees:(.*)\nRevenue:(.*)\nSummary:(.*)/i
@traceable
export class MerchantMonitoringScrapeService {
  private companiesHouseApiKey?: string
  private rapidApiKey?: string
  private scrapflyApiKey?: string
  private exploriumApiKey?: string
  private axios: AxiosInstance

  constructor() {
    this.axios = axios.create()

    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(error)
        return Promise.reject(error)
      }
    )
  }

  public static async init(): Promise<MerchantMonitoringScrapeService> {
    const secrets = await getSecretByName('MerchantMonitoring')

    const service = new MerchantMonitoringScrapeService()

    service.companiesHouseApiKey = secrets.companiesHouse
    service.rapidApiKey = secrets.rapidApi
    service.scrapflyApiKey = secrets.scrapfly
    service.exploriumApiKey = secrets.explorium
    return service
  }

  async getMerchantMonitoringSummaries(
    tenantId: string,
    userId: string,
    companyName: string,
    domain: string,
    options: {
      refresh: boolean
      skipExisting?: boolean
      onlyTypes?: MerchantMonitoringSourceType[]
      additionalDomains?: string[]
    } = {
      refresh: false,
      onlyTypes: MERCHANT_MONITORING_SOURCE_TYPES,
    }
  ): Promise<MerchantMonitoringSummary[]> {
    const { onlyTypes = MERCHANT_MONITORING_SOURCE_TYPES } = options
    const mongoDb = await getMongoDbClient()
    const merchantRepository = new MerchantRepository(tenantId, {
      mongoDb,
    })
    const existingSummaries = !options?.skipExisting
      ? await merchantRepository.getSummaries(userId)
      : []
    if (options?.refresh || !existingSummaries?.length) {
      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve(null), 20000)
      })

      const typesAndFunctions: {
        [key in MerchantMonitoringSourceType]: () => Promise<
          MerchantMonitoringSummary | undefined
        >
      } = {
        SCRAPE: () => this.scrape(domain),
        COMPANIES_HOUSE: () => this.companiesHouse(companyName),
        EXPLORIUM: () => this.explorium(companyName),
        LINKEDIN: () => this.linkedin(domain),
      }
      const results = (
        await Promise.allSettled(
          [
            ...(onlyTypes?.map(
              (t) =>
                typesAndFunctions[t]() as Promise<
                  MerchantMonitoringSummary | undefined
                >
            ) ?? []),
            ...(existingSummaries
              ?.filter(
                (s) =>
                  s.source?.sourceType === 'SCRAPE' &&
                  s.source?.sourceValue?.replace('https://', '') !== domain
              )
              .map((s) =>
                this.scrape(s.source?.sourceValue as string)
              ) as Promise<MerchantMonitoringSummary>[]),
          ].map((p) => Promise.race([p, timeout]))
        )
      )
        .map((p) => {
          if (p.status === 'fulfilled' && p.value) {
            return p.value
          }
        })
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .filter((p) => p && p.source) as MerchantMonitoringSummary[]

      if (options?.additionalDomains && onlyTypes?.includes('SCRAPE')) {
        const additionalResults = (
          await Promise.allSettled(
            options.additionalDomains.map((d) => this.scrape(ensureHttps(d)))
          )
        )
          .map((p) => {
            if (p.status === 'fulfilled' && p.value) {
              return p.value
            }
          })
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          .filter((p) => p && p.source) as MerchantMonitoringSummary[]
        results.push(...additionalResults)
      }

      await Promise.all(
        results
          .map(async (r) => {
            try {
              await merchantRepository.createMerchant(
                userId,
                domain,
                companyName,
                r
              )
            } catch (e) {
              logger.error(`${JSON.stringify(e)}`)
              return null
            }
            return r
          })
          .filter(Boolean)
      )
    }

    return (await merchantRepository.getSummaries(userId)) || []
  }

  async scrapeMerchantMonitoringSummary(
    tenantId: string,
    userId: string,
    companyName: string,
    domain: string
  ): Promise<MerchantMonitoringSummary> {
    const parsedUrl = ensureHttps(domain)
    const result = await this.scrape(parsedUrl)
    const mongoDb = await getMongoDbClient()
    const merchantRepository = new MerchantRepository(tenantId, {
      mongoDb,
    })
    await merchantRepository.createMerchant(userId, domain, companyName, result)
    return result
  }

  public async scrape(website: string): Promise<MerchantMonitoringSummary> {
    try {
      if (!this.scrapflyApiKey) {
        throw new Error('No scrapfly api key')
      }

      const response = await apiFetch<{
        result: { content: string }
      }>(
        `https://api.scrapfly.io/scrape?key=scp-live-${
          this.scrapflyApiKey
        }&url=${encodeURIComponent(
          ensureHttps(website)
        )}&render_js=true&rendering_wait=1000`,
        {
          retries: 3,
        }
      )

      let text = convert(response.result.result.content, {
        wordwrap: 130,
      })

      if (!text) {
        text = response.result.result.content
      }

      const summary = await this.summarise('SCRAPE', text)
      return {
        ...summary,
        source: { sourceType: 'SCRAPE', sourceValue: website },
      }
    } catch (e) {
      logger.error(e)
      throw e
    }
  }

  public async companiesHouse(
    companyName: string
  ): Promise<MerchantMonitoringSummary | undefined> {
    try {
      if (!this.companiesHouseApiKey) {
        throw new Error('No companies house api key')
      }

      const response = await apiFetch<{ items: any[] }>(
        `https://api.company-information.service.gov.uk/search/companies?q=${companyName}`,
        {
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(this.companiesHouseApiKey + ':').toString('base64'),
          },
        }
      )

      return this.summarise('COMPANIES_HOUSE', response?.result?.items[0])
    } catch (e) {
      logger.error(e)
      throw e
    }
  }

  public async linkedin(
    companyName: string
  ): Promise<MerchantMonitoringSummary | undefined> {
    if (!this.rapidApiKey) {
      throw new Error('No rapid api key')
    }
    const companyNameOption: AxiosRequestConfig = {
      method: 'POST',
      url: 'https://linkedin-company-data.p.rapidapi.com/linkedInCompanyUrlFromSearchTerm',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': this.rapidApiKey,
        'X-RapidAPI-Host': 'linkedin-company-data.p.rapidapi.com',
      },
      data: `{"searchTerms":["${companyName}"]}`,
    }

    const companyDomainData: any = await this.axios.request(companyNameOption)
    const companyDomain = companyDomainData.data.Results[0][companyName]
    const options: AxiosRequestConfig = {
      method: 'POST',
      url: 'https://linkedin-company-data.p.rapidapi.com/linkedInCompanyDataJson',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': this.rapidApiKey,
        'X-RapidAPI-Host': 'linkedin-company-data.p.rapidapi.com',
      },
      data: `{"liUrls":["${companyDomain}"]}`,
    }

    const data = await this.axios.request(options)

    const summary = await this.summarise('LINKEDIN', JSON.stringify(data.data))

    // Use linkedin description as the summary
    if (summary) {
      summary.summary = data.data.results[0].description
    }

    return summary
  }

  public async explorium(
    companyName: string
  ): Promise<MerchantMonitoringSummary | undefined> {
    if (!this.exploriumApiKey) {
      throw new InternalServerError('No explorium api key set')
    }

    const data = await this.axios.request({
      method: 'POST',
      url: ' https://app.explorium.ai/api/bundle/v1/enrich/firmographics',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        API_KEY: this.exploriumApiKey,
      },
      data: `[{"company": "${companyName}"}]`,
    })

    return this.summarise('EXPLORIUM', JSON.stringify(data.data))
  }

  private async summarise(
    source: MerchantMonitoringSourceType,
    content: string
  ): Promise<MerchantMonitoringSummary | undefined> {
    try {
      if (!content) {
        throw new Error('Unable to extract information from the given site')
      }
      const output = await prompt([
        {
          role: 'system',
          content:
            'You are a business intelligence API that will retrieve key values about a business from unstructured data. The key values are industry, products sold, location, number of employees, revenue and an overall summary.',
        },
        {
          role: 'system',
          content: `You will output your findings in the exact same format as this example:
Industry: Healthcare
Products: Medical Devices, Pharmaceuticals
Location: Delhi, India
Employees: 54
Revenue: $100000
Summary: Acme is a textile company which sells shoes in Delhi, India and generates a revenue of $100000 with 54 employees`,
        },
        {
          role: 'system',
          content: `Please choose the relevant industry from the following list: ${industries.join(
            ', '
          )}`,
        },
        {
          role: 'system',
          content: `Please choose the products sold from the following list: ${productTypes.join(
            ', '
          )}`,
        },
        {
          role: 'system',
          content: `Output the location one of the following formats "City, Country" or "Country"`,
        },
        {
          role: 'system',
          content: `Output the number of employees as a number range e.g. 1000-5000`,
        },
        {
          role: 'system',
          content: `Output the revenue as number range e.g. $1000-5000`,
        },
        {
          role: 'system',
          content: `If a value is unknown, please just say "Unspecified"`,
        },
        {
          role: 'user',
          content:
            `Please analyse the following content for a business:\n ${content}`.substring(
              0,
              MAX_TOKEN_OUTPUT
            ),
        },
      ])
      const re = new RegExp(OUTPUT_REGEX, 'm')
      const result: string[] = re.exec(output as string) as string[]

      if (!result || result.length < 2) {
        updateLogMetadata({ content, output, result })
        logger.error(`Unable to summarise ${source} content`)
        throw new Error('Unable to extract information from the given site')
      }

      return {
        source: { sourceType: source },
        industry: result[1],
        products: result[2].split(','),
        location: result[3] ?? '',
        employees: result[4] ?? '',
        revenue: result[5] ?? '',
        summary: result[6] ?? '',
        raw: content,
      }
    } catch (e) {
      logger.error(e)
      throw e
    }
  }
}
