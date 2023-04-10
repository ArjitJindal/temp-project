import fetch, { Headers } from 'node-fetch'
import axios, { AxiosRequestConfig } from 'axios'
import { convert } from 'html-to-text'
import { Configuration, OpenAIApi } from 'openai'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { getSecret } from '@/utils/secrets-manager'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MerchantRepository } from '@/lambdas/console-api-merchant/merchant-repository'
import { logger } from '@/core/logger'

const SUMMARY_PROMPT = `Please summarize a company from the following content outputting the industry the company operates in, the products they sell, their location, number of employees, revenue, summary. Please output as a comma separate list For example:

Industry: Textiles
Products: Shoes
Location: Delhi, India
Employees: 54
Revenue: $100000
Summary: Acme is a textile company which sells shoes in Delhi, India and generates a revenue of $100000 with 54 employees 

Here is the Input:`

const MAX_TOKEN_INPUT = 1000
const MAX_TOKEN_OUTPUT = 4096
const OPENAI_CREDENTIALS_SECRET_ARN = process.env
  .OPENAI_CREDENTIALS_SECRET_ARN as string
const OUTPUT_REGEX =
  /Industry:(.*)\nProducts:(.*)\nLocation:(.*)\nEmployees:(.*)\nRevenue:(.*)\nSummary:(.*)/i
const EXPLORIUM = 'c260b2b2-acc4-4770-adbf-949a673299f7'
const RAPID_API_KEY = '809e3aafbfmsh01888023c671678p1980dfjsn243d2752ecf7'
const COMPANIES_HOUSE_API_KEY = 'd42c2fb8-a93a-4545-bf7f-58dc77e826b3'
const SCRAPFLY_KEY = '7f58b1ed27ca4587bb666e595ddf2a6c'
export class MerchantMonitoringService {
  async getMerchantMonitoringSummaries(
    tenantId: string,
    companyName: string,
    domain: string,
    refresh?: boolean
  ): Promise<MerchantMonitoringSummary[]> {
    const mongoDb = await getMongoDbClient()
    const merchantRepository = new MerchantRepository(tenantId, {
      mongoDb,
    })
    if (!refresh) {
      try {
        const existingSummary = await merchantRepository.getMerchant(
          domain,
          companyName
        )
        logger.error(`${JSON.stringify(existingSummary)}`)
        if (existingSummary) {
          return existingSummary
        }
      } catch (e) {
        logger.error(JSON.stringify(e))
      }
    }

    const results = (
      await Promise.allSettled([
        this.scrape(`https://${domain}`),
        this.companiesHouse(companyName),
        this.explorium(companyName),
        this.linkedin(domain),
      ])
    )
      .map((p) => {
        if (p.status === 'fulfilled' && p.value) {
          return p.value
        }
      })
      .filter(Boolean) as MerchantMonitoringSummary[]

    // Store summaries in mongo

    // Hack in fake updated times
    const merchantSummary = Promise.all(
      results.map(async (r) => {
        if (refresh) {
          r.updatedAt = new Date().getTime()
        } else {
          const d = new Date()
          d.setDate(d.getDate() - 3)
          r.updatedAt = d.getTime()
        }
        try {
          await merchantRepository.createMerchant(r)
        } catch (e) {
          logger.error(`${JSON.stringify(e)}`)
        }

        return r
      })
    )

    return merchantSummary
  }

  async scrapeMerchantMonitoringSummary(
    companyName: string,
    domain: string
  ): Promise<MerchantMonitoringSummary> {
    const result = this.scrape(`https://${domain}`)

    // Store scrape result with company name in mongo

    return result
  }
  async getMerchantMonitoringHistory(
    source: MerchantMonitoringSource,
    companyName: string,
    domain: string
  ): Promise<MerchantMonitoringSummary[]> {
    // Search for summaries by company name and domain in mongo and return them

    // Fake it for now.
    let promise: Promise<MerchantMonitoringSummary>
    switch (source) {
      case 'SCRAPE':
        promise = this.scrape(`https://${domain}`)
        break
      case 'COMPANIES_HOUSE':
        promise = this.companiesHouse(companyName)
        break
      case 'EXPLORIUM':
        promise = this.explorium(companyName)
        break
      case 'LINKEDIN':
        promise = this.linkedin(domain)
    }

    const summary = await promise

    // Hack to make it look like history
    const summaries = [
      { ...summary },
      { ...summary },
      { ...summary },
      { ...summary },
      { ...summary },
      { ...summary },
      { ...summary },
    ]
    let days = 0
    return summaries.map((s) => {
      const d = new Date()
      d.setDate(d.getDate() - days)
      s.updatedAt = d.getTime()
      days += 21
      return s
    })
  }

  private async scrape(website: string): Promise<MerchantMonitoringSummary> {
    const options: AxiosRequestConfig = {
      method: 'GET',
      url: `https://api.scrapfly.io/scrape?key=scp-live-${SCRAPFLY_KEY}&url=${website}`,
    }
    const data = await axios.request(options)
    const text = convert(data.data.result.content, {
      wordwrap: 130,
    })
    return await this.summarise('SCRAPE', text)
  }

  private async companiesHouse(
    companyName: string
  ): Promise<MerchantMonitoringSummary> {
    const headers = new Headers()
    headers.set(
      'Authorization',
      'Basic ' + Buffer.from(COMPANIES_HOUSE_API_KEY + ':').toString('base64')
    )
    const response = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${companyName}`,
      {
        headers,
      }
    )
    return this.summarise('COMPANIES_HOUSE', (await response.json())?.items[0])
  }

  private async linkedin(
    companyDomain: string
  ): Promise<MerchantMonitoringSummary> {
    const options: AxiosRequestConfig = {
      method: 'POST',
      url: 'https://linkedin-company-data.p.rapidapi.com/linkedInCompanyDataByDomainJson',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': 'linkedin-company-data.p.rapidapi.com',
      },
      data: `{"domains":["${companyDomain.replace('https://', '')}"]}`,
    }

    const data = await axios.request(options)
    return this.summarise('LINKEDIN', JSON.stringify(data.data))
  }
  private async explorium(
    companyName: string
  ): Promise<MerchantMonitoringSummary> {
    const data = await axios.request({
      method: 'POST',
      url: ' https://app.explorium.ai/api/bundle/v1/enrich/firmographics',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        API_KEY: EXPLORIUM,
      },
      data: `[{"company": "${companyName}"}]`,
    })
    return this.summarise('EXPLORIUM', JSON.stringify(data.data))
  }

  private async summarise(
    source: MerchantMonitoringSource,
    content: string
  ): Promise<MerchantMonitoringSummary> {
    const configuration = new Configuration({
      apiKey: (
        await getSecret<{ apiKey: string }>(OPENAI_CREDENTIALS_SECRET_ARN)
      ).apiKey,
    })
    const openai = new OpenAIApi(configuration)
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          content: `${SUMMARY_PROMPT} ${content}`.slice(0, MAX_TOKEN_OUTPUT),
          role: 'system',
        },
      ],
      max_tokens: MAX_TOKEN_INPUT,
    })
    const output = completion.data.choices[0].message?.content
    const re = new RegExp(OUTPUT_REGEX, 'm')
    const result: string[] = re.exec(output as string) as string[]
    return {
      source,
      industry: result[1],
      products: result[2].split(','),
      location: result[3],
      employees: result[4],
      revenue: result[5],
      summary: result[6],
      raw: content,
    }
  }
}
