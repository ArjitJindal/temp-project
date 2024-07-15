import axios, { AxiosInstance } from 'axios'
import { convert } from 'html-to-text'
import { InternalServerError } from 'http-errors'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { getSecretByName } from '@/utils/secrets-manager'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MerchantRepository } from '@/services/merchant-monitoring/merchant-repository'
import { logger } from '@/core/logger'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { traceable } from '@/core/xray'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'
import { ensureHttps } from '@/utils/http'
import { apiFetch } from '@/utils/api-fetch'
import { MerchantSummariser } from '@/services/merchant-monitoring/merchant-summariser'

@traceable
export class MerchantMonitoringScrapeService {
  private companiesHouseApiKey?: string
  private scrapflyApiKey?: string
  private exploriumApiKey?: string
  private axios: AxiosInstance
  private summariser: MerchantSummariser

  constructor(
    companiesHouseApiKey: string,
    scrapflyApiKey: string,
    exploriumApiKey: string,
    summariser: MerchantSummariser
  ) {
    this.companiesHouseApiKey = companiesHouseApiKey
    this.scrapflyApiKey = scrapflyApiKey
    this.exploriumApiKey = exploriumApiKey
    this.summariser = summariser
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

    return new MerchantMonitoringScrapeService(
      secrets.companiesHouse,
      secrets.scrapfly,
      secrets.explorium,
      new MerchantSummariser()
    )
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

      const summary = await this.summariser.summarise('SCRAPE', text)
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

      return this.summariser.summarise(
        'COMPANIES_HOUSE',
        response?.result?.items[0]
      )
    } catch (e) {
      logger.error(e)
      throw e
    }
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

    return this.summariser.summarise('EXPLORIUM', JSON.stringify(data.data))
  }
}
