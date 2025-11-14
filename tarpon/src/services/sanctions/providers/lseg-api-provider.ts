import crypto from 'crypto'
import compact from 'lodash/compact'
import uniq from 'lodash/uniq'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import { COUNTRIES } from '@flagright/lib/constants'
import { backOff } from 'exponential-backoff'
import { SanctionsDataProviders, ProviderConfig } from '../types'
import type { SanctionsSearchRepository } from '../repositories/sanctions-search-repository'
import { LSEG_COUNTRY_CODES } from '../constants/lseg-country-code'
import { getFuzzinessThreshold } from './utils'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
} from '@/services/sanctions/providers/types'
import { getSecretByName } from '@/utils/secrets-manager'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { traceable } from '@/core/xray'
import { SanctionsSearchRequestEntityType } from '@/@types/openapi-internal/SanctionsSearchRequestEntityType'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { LSEGMediaCheckRequest } from '@/@types/openapi-internal/LSEGMediaCheckRequest'
import { LSEGCaseCreationRequest } from '@/@types/openapi-internal/LSEGCaseCreationRequest'
import { CaseEntityType } from '@/@types/openapi-internal/CaseEntityType'
import { ScreeningResultCollection } from '@/@types/openapi-internal/ScreeningResultCollection'
import dayjs from '@/utils/dayjs'
import { AbstractScreeningResult } from '@/@types/openapi-internal/AbstractScreeningResult'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { MediaCheckResultsResponse } from '@/@types/openapi-internal/MediaCheckResultsResponse'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { SanctionsIdDocument } from '@/@types/openapi-internal/SanctionsIdDocument'
import { logger } from '@/core/logger'
import { SanctionsNameMatched } from '@/@types/openapi-internal/SanctionsNameMatched'

interface LSEGRecordDetail {
  names?: {
    nameDetails?: Array<{
      type?: string
      details?: Array<{ type?: string; value?: string }>
    }>
  }
  connections?: {
    connectionDetails?: Array<{
      connectionType?: string
      referenceId?: string
      names?: {
        nameDetails?: Array<{
          type?: string
          details?: Array<{ type?: string; value?: string }>
        }>
      }
    }>
  }
  sourceReferenceLinks?: {
    sourceReferenceLinkDetails?: Array<{
      uri?: string
    }>
  }
  sources?: Array<{ name?: string }>
  furtherInformation?: {
    details?: Array<{
      detailType?: string
      text?: string
    }>
  }
  roles?: {
    roleDetails?: Array<{
      biography?: string
      effectiveFrom?: string
      effectiveTo?: string
    }>
  }
}

function getLsegEntityType(
  entityType?: SanctionsSearchRequestEntityType
): CaseEntityType {
  switch (entityType) {
    case 'PERSON':
      return 'INDIVIDUAL'
    case 'BUSINESS':
      return 'ORGANISATION'
    default:
      return 'INDIVIDUAL'
  }
}

@traceable
export class LSEGAPIDataProvider implements SanctionsDataProvider {
  private keyId: string
  private secret: string
  private tenantId: string
  private groupId: string
  private baseUrl: string = 'https://api.risk.lseg.com/screening/v3'
  constructor(
    tenantId: string,
    keyId: string,
    secret: string,
    groupId: string
  ) {
    this.tenantId = tenantId
    this.groupId = groupId
    this.keyId = keyId
    this.secret = secret
  }
  static async build(tenantId: string) {
    const secrets = await getSecretByName('lsegApiCreds')
    const keyId = secrets[tenantId].keyId
    const secret = secrets[tenantId].secret
    const groupId = secrets[tenantId].groupId

    if (!keyId || !secret || !groupId) {
      throw new Error(
        `No credentials found for LSEG API for tenant ${tenantId}`
      )
    }
    return new LSEGAPIDataProvider(tenantId, keyId, secret, groupId)
  }

  provider(): SanctionsDataProviderName {
    return SanctionsDataProviders.LSEG_API
  }

  private getPostHeaders(url: string, body: string) {
    const method = 'POST'
    const host = new URL(url).host
    const date = new Date().toUTCString()
    const contentType = 'application/json'
    const contentLength = Buffer.byteLength(body).toString()
    const path = new URL(url).pathname

    const signingString =
      `(request-target): ${method.toLowerCase()} ${path}\n` +
      `host: ${host}\n` +
      `date: ${date}\n` +
      `content-type: ${contentType}\n` +
      `content-length: ${contentLength}\n` +
      `${body}`

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signingString)
      .digest('base64')

    return {
      Authorization: `Signature keyId="${this.keyId}",algorithm="hmac-sha256",headers="(request-target) host date content-type content-length",signature="${signature}"`,
      Host: host,
      Date: date,
      'Content-Type': contentType,
      'Content-Length': contentLength,
    }
  }

  private getGetHeaders(url: string) {
    const method = 'GET'
    const host = new URL(url).host
    const date = new Date().toUTCString()
    const path = new URL(url).pathname
    const signingString =
      `(request-target): ${method.toLowerCase()} ${path}\n` +
      `host: ${host}\n` +
      `date: ${date}`

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signingString)
      .digest('base64')

    const authorization = `Signature keyId="${this.keyId}",algorithm="hmac-sha256",headers="(request-target) host date",signature="${signature}"`
    return {
      Host: host,
      Date: date,
      Authorization: authorization,
    }
  }

  private async post<T, R>(url: string, body: T): Promise<R> {
    const result = await backOff(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.getPostHeaders(url, JSON.stringify(body)),
          body: JSON.stringify(body),
        })
        const r = await response.json()
        if (response.status === 429) {
          throw new Error('Rate limit exceeded for LSEG API')
        }
        if (response.status !== 200) {
          logger.info(`Error ${response.status} for LSEG API ${url}`, {
            body: JSON.stringify(body),
            response: JSON.stringify(r),
          })
          return undefined
        }
        return r
      },
      {
        startingDelay: 1000,
        timeMultiple: 1,
        maxDelay: 1000,
        numOfAttempts: 4,
        delayFirstAttempt: true,
      }
    )
    return result as R
  }

  private async get<R>(url: string): Promise<R> {
    const result = await backOff(
      async () => {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getGetHeaders(url),
        })
        if (response.status === 429) {
          throw new Error('Rate limit exceeded for LSEG API')
        }
        if (response.status !== 200) {
          return undefined
        }
        return await response.json()
      },
      {
        startingDelay: 1000,
        timeMultiple: 1,
        maxDelay: 1000,
        numOfAttempts: 4,
        delayFirstAttempt: true,
      }
    )
    return result as R
  }

  public async getMediaCheckArticleContents(
    caseId: string,
    articleIds: string[]
  ): Promise<MediaCheckResultsResponse> {
    const url = `${this.baseUrl}/cases/${caseId}/media-check/results/content`
    const body: { articleIds: string[] } = {
      articleIds: articleIds,
    }
    return await this.post<{ articleIds: string[] }, MediaCheckResultsResponse>(
      url,
      body
    )
  }

  private getDateRange(request: SanctionsSearchRequest): {
    startDate: string
    endDate: string
  } {
    let startDate: string | undefined = dayjs()
      .subtract(5, 'year')
      .toISOString()
    let endDate: string | undefined = dayjs().toISOString()
    if (request.lsegMediaCheck?.timeWindow?.endGranularity) {
      if (
        request.lsegMediaCheck?.timeWindow?.endUnits &&
        request.lsegMediaCheck?.timeWindow?.endGranularity &&
        request.lsegMediaCheck?.timeWindow?.endGranularity !== 'now' &&
        request.lsegMediaCheck?.timeWindow?.endGranularity !== 'all_time'
      ) {
        startDate = dayjs()
          .subtract(
            request.lsegMediaCheck?.timeWindow?.endUnits,
            request.lsegMediaCheck?.timeWindow?.endGranularity
          )
          .toISOString()
      }
    }
    if (request.lsegMediaCheck?.timeWindow?.startGranularity) {
      if (
        request.lsegMediaCheck?.timeWindow?.startUnits &&
        request.lsegMediaCheck?.timeWindow?.startGranularity &&
        request.lsegMediaCheck?.timeWindow?.startGranularity !== 'now' &&
        request.lsegMediaCheck?.timeWindow?.startGranularity !== 'all_time'
      ) {
        endDate = dayjs()
          .subtract(
            request.lsegMediaCheck?.timeWindow?.startUnits,
            request.lsegMediaCheck?.timeWindow?.startGranularity
          )
          .toISOString()
      }
    }
    return { startDate, endDate }
  }

  private async createCase(
    request: SanctionsSearchRequest
  ): Promise<ScreeningResultCollection | null> {
    const url = `${this.baseUrl}/cases?screen=SYNC`
    const body: LSEGCaseCreationRequest = {
      name: request.searchTerm,
      groupId: this.groupId,
      entityType: getLsegEntityType(request.entityType),
      providerTypes: ['MEDIA_CHECK', 'WATCHLIST'],
      caseScreeningState: {
        MEDIA_CHECK: 'ONGOING',
        WATCHLIST: 'ONGOING',
      },
    }
    return await this.post<LSEGCaseCreationRequest, ScreeningResultCollection>(
      url,
      body
    )
  }

  public async getMediaCheckResultsForCase(
    caseId: string,
    dateRange: {
      startDate: string
      endDate: string
    },
    pageReference?: string
  ): Promise<MediaCheckResultsResponse> {
    const url = `${this.baseUrl}/cases/${caseId}/media-check/results`
    const body: LSEGMediaCheckRequest = {
      baseFilter: {
        smartFilter: true,
        publicationDate: {
          min: dateRange.startDate,
          max: dateRange.endDate,
        },
      },
      facets: {
        geographies: {
          limit: 10,
        },
        topics: {
          limit: 10,
        },
        publicationTypes: {
          limit: 10,
        },
        phases: {
          limit: 10,
        },
      },
      sort: {
        columnName: 'publicationDate',
        order: 'DESCENDING',
      },
      pagination: {
        itemsPerPage: 100,
        pageReference: pageReference,
      },
    }
    return await this.post<LSEGMediaCheckRequest, MediaCheckResultsResponse>(
      url,
      body
    )
  }

  public async startSearch(
    params: {
      provider: SanctionsDataProviderName
      request: SanctionsSearchRequest
      mongoHash: string
      dynamoHash: string
      isBackfillDone: boolean
      providerConfig?: ProviderConfig
    },
    sanctionRepository: SanctionsSearchRepository
  ): Promise<SanctionsSearchResponse | null> {
    const searchHistoryResponse =
      await sanctionRepository.getSearchResultByParams({
        ...params,
        fetchResponse: true,
      })
    if (
      searchHistoryResponse?.searchId &&
      searchHistoryResponse?.providerReferenceIds?.length
    ) {
      return searchHistoryResponse
    }

    const response = await this.search(params.request)
    return {
      ...response,
      searchId: searchHistoryResponse?.searchId ?? uuidv4(),
    }
  }

  private transformEntities(
    entities: AbstractScreeningResult[],
    request: SanctionsSearchRequest
  ): SanctionsEntity[] {
    const fuzzinessThreshold = getFuzzinessThreshold(request)
    return entities
      .filter((entity) => {
        return (
          entity.matchScore == null ||
          entity.matchScore >= 100 - fuzzinessThreshold
        )
      })
      .map((entity) => {
        const primaryName =
          entity.names
            ?.find((name) => name.type === 'PRIMARY')
            ?.details?.find((detail) => detail.type === 'FULL_NAME')?.value ??
          ''
        const dateOfBirths = entity.dates?.filter(
          (date) =>
            date.type === 'BIRTH' ||
            date.type === 'CALCULATED_YOB' ||
            date.type === 'REPORTED_DOB'
        )
        const nationality =
          entity.locations
            ?.filter((location) => location.type === 'NATIONALITY')
            ?.map((location) => location.country?.name) ?? []
        const allCountryCodes = uniq(
          compact(
            entity.locations?.map((location) => location.country?.name) ?? []
          ).map((c) => LSEG_COUNTRY_CODES[c]) as CountryCode[]
        )
        const gender =
          entity.genders?.find((gender) => gender.value === 'MALE')?.value ??
          'UNKNOWN'
        const document: SanctionsIdDocument[] =
          entity.identifications?.map((identification) => {
            return {
              id: identification.value,
              name: identification.type,
            }
          }) ?? []
        return {
          id: entity.referenceId,
          resourceId: entity.resultId,
          provider: this.provider(),
          name: primaryName,
          aka: [],
          normalizedAka: [],
          entityType: request.entityType === 'PERSON' ? 'PERSON' : 'BUSINESS',
          sanctionSearchTypes: [],
          types: compact(entity.sourceCategories || []),
          dateOfBirths: compact(dateOfBirths?.map((date) => date.value)),
          countries: compact(allCountryCodes).map((c) => COUNTRIES[c]),
          nationality: compact(nationality).map(
            (c) => LSEG_COUNTRY_CODES[c]
          ) as CountryCode[],
          countryCodes: allCountryCodes as CountryCode[],
          documents: document,
          gender: gender,
          matchTypeDetails: (entity.matchedTerms?.map((t) => t.term) ?? []).map(
            (t) => ({
              amlTypes: [],
              matchingName: t ?? '',
              nameMatches: [
                {
                  match_types:
                    entity.matchScore == 100 ? ['exact_match'] : ['name_fuzzy'],
                  query_term: request.searchTerm,
                },
              ] as SanctionsNameMatched[],
              secondaryMatches: [],
              sources: [],
            })
          ),
        }
      })
  }

  public async hydrateSearchResults(
    refRecords: SanctionsEntity[]
  ): Promise<SanctionsEntity[]> {
    const records: SanctionsEntity[] = []
    for (const refRecord of refRecords) {
      const record = await this.get<LSEGRecordDetail>(
        `${this.baseUrl}/references/records/${refRecord.id}`
      )
      const aka = uniq(
        compact<string>(
          record?.names?.nameDetails?.flatMap((name) =>
            name.details?.map((detail) => detail.value)
          ) ?? []
        )
      )
      records.push({
        ...refRecord,
        associates: record?.connections?.connectionDetails?.map((c) => {
          return {
            association: c?.connectionType,
            id: c?.referenceId,
            name:
              c?.names?.nameDetails
                ?.find((name) => name.type === 'PRIMARY')
                ?.details?.find((detail) => detail.type === 'FULL_NAME')
                ?.value ?? '',
          }
        }),
        screeningSources:
          record?.sourceReferenceLinks?.sourceReferenceLinkDetails?.map((s) => {
            return {
              url: s?.uri,
              name: s?.uri,
            }
          }),
        types: [
          ...(refRecord.types ?? []),
          ...compact(record?.sources?.map((s) => s?.name) ?? []),
        ],
        freetext: record?.furtherInformation?.details
          ?.map((d) => `${d?.detailType}: ${d?.text}`)
          ?.join('\n'),
        occupations: record?.roles?.roleDetails?.map((r) => {
          return {
            title: r?.biography,
            dateFrom: r?.effectiveFrom,
            dateTo: r?.effectiveTo,
          }
        }),
        aka: aka,
        normalizedAka: aka,
      })
    }
    return records
  }

  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const caseResponse = await this.createCase(request)
    if (!caseResponse?.caseSystemId) {
      return {
        data: [],
        hitsCount: 0,
        providerSearchId: '',
        createdAt: Date.now(),
        providerReferenceIds: [],
      }
    }
    const response = this.transformEntities(caseResponse.results, request)
    if (response.length > 0) {
      await sendBatchJobCommand({
        tenantId: this.tenantId,
        type: 'FETCH_LSEG_MEDIA_CHECK_RESULTS',
        parameters: {
          caseId: caseResponse.caseSystemId,
          dateRange: this.getDateRange(request),
        },
      })
    }
    return {
      data: response,
      hitsCount: response.length,
      providerSearchId: '',
      request,
      createdAt: Date.now(),
      providerReferenceIds: caseResponse.caseSystemId
        ? [caseResponse.caseSystemId]
        : [],
      isNewSearch: caseResponse.caseSystemId ? true : false,
    }
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    return {
      data: [],
      hitsCount: 0,
      providerSearchId,
      createdAt: Date.now(),
      providerReferenceIds: [],
    }
  }

  async deleteSearch(_providerSearchId: string): Promise<void> {}
}
