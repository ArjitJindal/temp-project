import fetch, { Headers } from 'node-fetch'
import axios, { AxiosRequestConfig, AxiosInstance } from 'axios'
import { convert } from 'html-to-text'
import { NotFound, InternalServerError } from 'http-errors'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { getSecret } from '@/utils/secrets-manager'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MerchantRepository } from '@/lambdas/console-api-merchant/merchant-repository'
import { logger } from '@/core/logger'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { traceable } from '@/core/xray'
import { ask } from '@/utils/openapi'
import { ensureHttps } from '@/utils/http'

const SUMMARY_PROMPT = `Please summarize a company from the following content outputting the industry the company operates in, the products they sell, their location, number of employees, revenue, summary. Please output as a comma separate list For example:

Industry: Textiles
Products: Shoes
Location: Delhi, India
Employees: 54
Revenue: $100000
Summary: Acme is a textile company which sells shoes in Delhi, India and generates a revenue of $100000 with 54 employees 

Here is the Input:`

const MAX_TOKEN_OUTPUT = 4096

const OUTPUT_REGEX =
  /Industry:(.*)\nProducts:(.*)\nLocation:(.*)\nEmployees:(.*)\nRevenue:(.*)\nSummary:(.*)/i

type MerchantMonitoringSecrets = {
  companiesHouse: string
  rapidApi: string
  scrapfly: string
  explorium: string
}

@traceable
export class MerchantMonitoringScrapeService {
  private companiesHouseApiKey?: string
  private rapidApiKey?: string
  private scrapflyApiKey?: string
  private exploriumApiKey?: string
  private axios: AxiosInstance

  constructor(merchantMonitoringSecrets: MerchantMonitoringSecrets) {
    this.companiesHouseApiKey = merchantMonitoringSecrets.companiesHouse
    this.rapidApiKey = merchantMonitoringSecrets.rapidApi
    this.scrapflyApiKey = merchantMonitoringSecrets.scrapfly
    this.exploriumApiKey = merchantMonitoringSecrets.explorium
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
    const merchantMonitoringSecrets =
      await getSecret<MerchantMonitoringSecrets>(
        process.env.MERCHANT_MONITORING_SECRETS_ARN as string
      )

    return new MerchantMonitoringScrapeService(merchantMonitoringSecrets)
  }

  async getMerchantMonitoringSummaries(
    tenantId: string,
    userId: string,
    companyName: string,
    domain: string,
    refresh?: boolean
  ): Promise<MerchantMonitoringSummary[]> {
    const mongoDb = await getMongoDbClient()
    const merchantRepository = new MerchantRepository(tenantId, {
      mongoDb,
    })

    const existingSummaries = await merchantRepository.getSummaries(userId)

    if (refresh || (existingSummaries && existingSummaries.length === 0)) {
      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve(null), 20000)
      })
      const results = (
        await Promise.allSettled(
          [
            this.scrape(domain),
            this.companiesHouse(companyName),
            this.explorium(companyName),
            this.linkedin(domain),
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

    const updatedSummaries = await merchantRepository.getSummaries(userId)
    if (updatedSummaries && updatedSummaries.length) {
      return updatedSummaries
    }
    throw new NotFound('No summaries found')
  }

  async scrapeMerchantMonitoringSummary(
    tenantId: string,
    userId: string,
    companyName: string,
    domain: string
  ): Promise<MerchantMonitoringSummary> {
    const parsedUrl = `https://${domain
      .replace('https://', '')
      .replace('http://', '')}`
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

      const options: AxiosRequestConfig = {
        method: 'GET',
        url: `https://api.scrapfly.io/scrape?key=scp-live-${
          this.scrapflyApiKey
        }&url=${encodeURIComponent(
          ensureHttps(website)
        )}&render_js=true&rendering_wait=1000`,
      }
      const data = await this.axios.request(options)

      let text = convert(data.data.result.content, {
        wordwrap: 130,
      })

      if (!text) {
        text = data.data.result.content
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
      const headers = new Headers()
      headers.set(
        'Authorization',
        'Basic ' +
          Buffer.from(this.companiesHouseApiKey + ':').toString('base64')
      )
      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/companies?q=${companyName}`,
        {
          headers,
        }
      )

      return this.summarise(
        'COMPANIES_HOUSE',
        (await response.json())?.items[0]
      )
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
    return this.summarise('LINKEDIN', JSON.stringify(data.data))
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
        return undefined // Sometimes the source doesn't return anything hence the undefined
      }

      const output = await ask(
        `${SUMMARY_PROMPT} ${content}`.slice(0, MAX_TOKEN_OUTPUT)
      )
      const re = new RegExp(OUTPUT_REGEX, 'm')
      const result: string[] = re.exec(output as string) as string[]

      if (!result || result.length < 2) {
        throw new Error('Unable to extract information')
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
