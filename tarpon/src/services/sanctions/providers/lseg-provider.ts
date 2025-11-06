import { Readable, PassThrough } from 'stream'
import * as zlib from 'zlib'
import * as path from 'path'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import SFTPClient from 'ssh2-sftp-client'

import { humanizeAuto } from '@flagright/lib/utils/humanize'
import compact from 'lodash/compact'
import { COUNTRIES } from '@flagright/lib/constants'
import { SanctionsDataProviders, Gender } from '../types'
import { LSEG_COUNTRY_CODES } from '../constants/lseg-country-code'
import { LSEGKeywordInfo } from '../constants/lseg-keyword-type'
import {
  EXTERNAL_TO_INTERNAL_MAPPINGS,
  RELATIVE_OR_CLOSE_ASSOCIATE_TYPES,
} from '../constants/lseg-constants'
import { normalizeSource } from '../utils'
import { SanctionsDataFetcher } from './sanctions-data-fetcher'
import { SanctionsRepository, Action } from './types'
import { getNameAndAka } from './utils'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { tenantSettings } from '@/core/utils/context'
import dayjs from '@/utils/dayjs'

import { LSEGSanctionsSearchType } from '@/@types/openapi-internal/LSEGSanctionsSearchType'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsIdDocument } from '@/@types/openapi-internal/SanctionsIdDocument'
import { SanctionsAssociate } from '@/@types/openapi-internal/SanctionsAssociate'
import { SanctionsEntityAddress } from '@/@types/openapi-internal/SanctionsEntityAddress'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsEntityOtherSources } from '@/@types/openapi-internal/SanctionsEntityOtherSources'
import { LSEG_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/LSEGSanctionsSearchType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongo-table-names'
import { SanctionsOccupation } from '@/@types/openapi-internal/SanctionsOccupation'

@traceable
export class LSEGProvider extends SanctionsDataFetcher {
  authHeader: string
  private screeningTypes: LSEGSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]
  private keywords: Record<string, LSEGKeywordInfo> = {}
  private keywordsLastUpdated: Date | null = null
  private sftpUsername: string
  private sftpPassword: string

  static async build(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    let types: LSEGSanctionsSearchType[] | undefined
    let entityTypes: SanctionsEntityType[] | undefined
    const settings = await tenantSettings(tenantId)
    const lsegSettings = settings?.sanctions?.providerScreeningTypes?.find(
      (type) => type.provider === SanctionsDataProviders.LSEG
    )
    const sanctions = settings?.sanctions
    if (lsegSettings) {
      types = lsegSettings.screeningTypes as LSEGSanctionsSearchType[]
      entityTypes = lsegSettings.entityTypes as SanctionsEntityType[]
    }
    if (sanctions?.lsegCreds?.username && sanctions?.lsegCreds?.password) {
      return new LSEGProvider(
        sanctions.lsegCreds.username,
        sanctions.lsegCreds.password,
        tenantId,
        types ?? LSEG_SANCTIONS_SEARCH_TYPES,
        entityTypes ?? SANCTIONS_ENTITY_TYPES,
        connections
      )
    }
    throw new Error(`No credentials found for LSEG for tenant ${tenantId}`)
  }

  constructor(
    username: string,
    password: string,
    tenantId: string,
    screeningTypes: LSEGSanctionsSearchType[],
    entityTypes: SanctionsEntityType[],
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    super(SanctionsDataProviders.LSEG, tenantId, connections)
    this.authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
    this.sftpUsername = username
    this.sftpPassword = password
    this.screeningTypes = screeningTypes
    this.entityTypes = entityTypes

    // Initialize with empty keywords - will be loaded dynamically
    this.keywords = {}
  }

  private async downloadKeywordsFile(): Promise<string> {
    const url =
      'https://www.world-check.com/static/documents/reference/world-check/keyword-lists/World-Check_Keyword-list-all-fields.xml'

    logger.info(`Downloading LSEG keywords file from ${url}`)

    const response = await axios.get(url, {
      headers: {
        Authorization: this.authHeader,
      },
      responseType: 'text',
      timeout: 30000,
    })

    return response.data
  }

  private parseKeywordsFile(xmlContent: string): void {
    logger.info('Parsing LSEG keywords file...')

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      isArray: (tagName) => tagName === 'keyword',
    })

    const jsonObj = parser.parse(xmlContent)
    const keywords: Record<string, LSEGKeywordInfo> = {}

    if (jsonObj.keywords && jsonObj.keywords.keyword) {
      for (const item of jsonObj.keywords.keyword) {
        const type = item['@_type']
        if (
          type === 'sanctions' ||
          type === 'regulatory enforcement' ||
          type === 'law enforcement'
        ) {
          const keywordInfo: LSEGKeywordInfo = {
            sourceName: item.name,
            sourceCountry: item.country,
            type:
              type === 'sanctions'
                ? 'SANCTIONS'
                : 'REGULATORY_ENFORCEMENT_LIST',
          }
          keywords[item.abbreviation] = keywordInfo
        }
      }
    }
    this.keywords = keywords

    this.keywordsLastUpdated = new Date()
    logger.info(`Processed ${Object.keys(this.keywords).length} total keywords`)
  }

  private async ensureKeywordsLoaded(): Promise<void> {
    // Always try to load keywords if they haven't been loaded yet, or refresh every 24 hours
    const shouldRefresh =
      !this.keywordsLastUpdated ||
      Date.now() - this.keywordsLastUpdated.getTime() > 24 * 60 * 60 * 1000

    if (shouldRefresh) {
      try {
        const xmlContent = await this.downloadKeywordsFile()
        this.parseKeywordsFile(xmlContent)
      } catch (error) {
        logger.error('Failed to download keywords file:', error)
        // No fallback - keywords will remain empty if download fails
        logger.warn('Keywords will not be available for this session')
      }
    }
  }

  /**
   * Manually refresh keywords from the LSEG API
   * This can be called to force an update of keywords
   */
  public async refreshKeywords(): Promise<void> {
    try {
      const xmlContent = await this.downloadKeywordsFile()
      this.parseKeywordsFile(xmlContent)
      logger.info('Keywords refreshed successfully')
    } catch (error) {
      logger.error('Failed to refresh keywords:', error)
      throw error
    }
  }

  private async downloadFeed(
    params: Record<string, string>
  ): Promise<Readable> {
    const url = new URL('https://www.world-check.com/premium-dynamic-download/')
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    logger.info(`Downloading LSEG feed from ${url.toString()}`)

    const response = await axios.get<Readable>(url.toString(), {
      headers: {
        Authorization: this.authHeader,
      },
      responseType: 'stream',
    })

    return response.data
  }

  private async downloadFullFileViaSftp(): Promise<{
    stream: Readable
    abort: () => Promise<void>
    sftp: SFTPClient
  }> {
    const sftp = new SFTPClient()
    const host = 'sftp.world-check.com'
    const remoteDir = `/home/${this.sftpUsername}/premium_datafiles`
    const remoteFile = 'premium-world-check.xml.gz'
    const remotePath = path.posix.join(remoteDir, remoteFile)

    await sftp.connect({
      host,
      port: 22,
      username: this.sftpUsername,
      password: this.sftpPassword,
      readyTimeout: 60_000,
      keepaliveInterval: 20_000,
      keepaliveCountMax: 10,
    })

    logger.info(`Starting SFTP download of ${remoteFile}`)

    const pass = new PassThrough()

    // Start streaming download without waiting for completion
    // This allows processing to begin immediately as data arrives,
    // rather than buffering the entire file (36GB+) in memory
    sftp
      .get(remotePath, pass as unknown as NodeJS.WritableStream)
      .then(() => logger.info(`SFTP download completed for ${remoteFile}`))
      .catch((err: unknown) => {
        logger.error('SFTP download failed', { error: String(err) })
        pass.destroy(err as Error)
      })

    const abort = async () => {
      pass.destroy(new Error('SFTP aborted'))
      await Promise.race([
        sftp.end(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]).catch((e) =>
        logger.warn('SFTP end failed during abort', { error: String(e) })
      )
    }

    return {
      stream: pass as unknown as Readable,
      abort,
      sftp,
    }
  }

  async fullLoad(repo: SanctionsRepository, version: string) {
    logger.info('Starting LSEG full load via SFTP', { version })
    let sftpSession: {
      stream: Readable
      abort: () => Promise<void>
      sftp: SFTPClient
    } | null = null

    try {
      const session = await this.downloadFullFileViaSftp()
      sftpSession = session

      await this.processFeed(session.stream, repo, version)
      await session.sftp.end()

      logger.info('LSEG full load completed', { version })
    } catch (error) {
      logger.error('SFTP full load failed', {
        error: String(error),
        stack: (error as Error).stack,
        version,
      })

      if (sftpSession) {
        await sftpSession.abort()
        await sftpSession.sftp
          .end()
          .catch((e) => logger.warn('SFTP end failed', { error: String(e) }))
      }

      logger.info('Falling back to HTTPS download', { version })
      const httpStream = await this.downloadFeed({ format: 'XML-GZ' })
      await this.processFeed(httpStream, repo, version)
      logger.info('LSEG full load completed via HTTPS', { version })
    }
    await this.hydrateAssociates(repo, version)
  }
  async delta(repo: SanctionsRepository, version: string, from: Date) {
    logger.info(
      `Starting LSEG delta load file download from ${from.toISOString()}.`
    )
    const fromDate = dayjs(from).format('YYYY/MM/DD')
    const stream = await this.downloadFeed({
      format: 'XML-GZ',
      lag: 'CUSTOM',
      from: fromDate,
    })
    await this.processFeed(stream, repo, version)
    logger.info('LSEG delta load completed.')
    await this.hydrateAssociates(repo, version)
  }

  private async hydrateAssociates(repo: SanctionsRepository, version: string) {
    logger.info(
      `Starting LSEG associate direct hydration for version ${version}.`
    )
    const sanctionsCollection = (await this.getMongoDbClient())
      .db()
      .collection<SanctionsEntity>(SANCTIONS_COLLECTION(this.tenantId))

    const cursor = sanctionsCollection.find(
      {
        'associates.0': { $exists: true },
      },
      {
        projection: { id: 1, associates: 1, _id: 0 },
      }
    )

    await processCursorInBatch(
      cursor,
      async (batch) => {
        const parentToAssociatesMap = new Map<
          string,
          { id: string; association: string }[]
        >()

        for (const doc of batch) {
          if (doc.id && doc.associates) {
            const associatesToSave = doc.associates
              .filter((a) => a.id)
              .map((a) => ({
                id: a.id as string,
                association: a.association || '',
              }))

            if (associatesToSave.length > 0) {
              parentToAssociatesMap.set(doc.id, associatesToSave)
            }
          }
        }

        if (parentToAssociatesMap.size > 0) {
          logger.info(
            `Hydrating associates for a batch of ${parentToAssociatesMap.size} entities.`
          )
          await repo.saveAssociations(
            this.provider() as SanctionsDataProviders,
            Array.from(parentToAssociatesMap.entries()),
            version
          )
        }
      },
      {
        processBatchSize: 500,
        mongoBatchSize: 500,
      }
    )

    logger.info('Finished LSEG associate direct hydration.')
  }

  private getSanctionsSearchType(
    subCategory: string,
    keywords: string[],
    specialInterestCategories: string[]
  ): LSEGSanctionsSearchType[] {
    const sanctionsSearchTypes: LSEGSanctionsSearchType[] = []

    keywords.forEach((keyword: string) => {
      const keywordInfo = this.keywords[keyword]
      if (keywordInfo) {
        if (keywordInfo.type === 'SANCTIONS') {
          sanctionsSearchTypes.push('SANCTIONS')
        } else if (keywordInfo.type === 'REGULATORY_ENFORCEMENT_LIST') {
          sanctionsSearchTypes.push('REGULATORY_ENFORCEMENT_LIST')
        }
      }
    })

    if (specialInterestCategories.length > 0) {
      sanctionsSearchTypes.push('ADVERSE_MEDIA')
    }

    if (
      subCategory?.startsWith('PEP') ||
      ['SOE', 'SIE'].includes(subCategory)
    ) {
      sanctionsSearchTypes.push('PEP')
    }
    // return unique sanctions search types
    return [...new Set(sanctionsSearchTypes)]
  }

  private getOccupationsAndPepDetails(
    pepRoleDetails: any,
    subCategory: string
  ): {
    occupations: Array<SanctionsOccupation>
    pepSources: SanctionsSource[]
    pepTypes: string[]
  } {
    if (!pepRoleDetails || !pepRoleDetails.pep_role_detail) {
      return {
        occupations: [],
        pepSources: [],
        pepTypes: [],
      }
    }
    const pepRoleDetailsList = Array.isArray(pepRoleDetails.pep_role_detail)
      ? pepRoleDetails.pep_role_detail
      : [pepRoleDetails.pep_role_detail]

    const occupations: Array<SanctionsOccupation> = []
    const pepSources: SanctionsSource[] = []
    const pepTypesSet = new Set<string>()

    if (
      subCategory &&
      RELATIVE_OR_CLOSE_ASSOCIATE_TYPES.includes(subCategory)
    ) {
      pepTypesSet.add('Relative or close associate')
      pepSources.push({
        name: EXTERNAL_TO_INTERNAL_MAPPINGS[subCategory],
        category: 'PEP',
        sourceName: 'pep by associations',
      })
    }

    pepRoleDetailsList.forEach((roleDetail: any) => {
      const termStartDate =
        roleDetail.pep_role_term_start_date?.['#text'] ||
        roleDetail.pep_role_term_start_date
      const termEndDate =
        roleDetail.pep_role_term_end_date?.['#text'] ||
        roleDetail.pep_role_term_end_date

      // Map occupations (keep existing logic)
      occupations.push({
        title: roleDetail.pep_position,
        // occupationCode: roleDetail.pep_role_level || undefined,
        // rank: roleDetail.pep_role_level || undefined,
        dateFrom: termStartDate
          ? dayjs(termStartDate).format('YYYY-MM-DD')
          : undefined,
        dateTo: termEndDate
          ? dayjs(termEndDate).format('YYYY-MM-DD')
          : undefined,
      })

      // Map pepTypes based on pep_role_status
      const pepRoleStatus = roleDetail.pep_role_status
      if (pepRoleStatus === 'current') {
        pepTypesSet.add('Current PEP')
      } else if (pepRoleStatus === 'former') {
        pepTypesSet.add('Former PEP')
      }
      // Map pepSources
      const pepRoleLevel = roleDetail.pep_role_level
      const pepRoleBio = roleDetail.pep_role_bio

      if (pepRoleLevel) {
        const source = new SanctionsSource()
        source.name =
          EXTERNAL_TO_INTERNAL_MAPPINGS[pepRoleLevel] || pepRoleLevel
        source.description = pepRoleBio
        source.category = 'PEP'
        source.sourceName = normalizeSource(pepRoleLevel)
        pepSources.push(source)
      }
    })

    return {
      occupations,
      pepSources,
      pepTypes: Array.from(pepTypesSet),
    }
  }

  private getDocuments(record: any): SanctionsIdDocument[] {
    const documents: SanctionsIdDocument[] = []
    const addedIds = new Set<string>()

    // Extract passports
    const passports = record.details?.passports?.passport || []
    if (Array.isArray(passports)) {
      passports.forEach((passport: any) => {
        if (!passport) {
          return
        }

        const passportId =
          typeof passport === 'string' ? passport : passport['#text']
        if (!passportId || addedIds.has(passportId)) {
          return
        }

        const doc = new SanctionsIdDocument()
        doc.id = passportId
        doc.name = 'PASSPORT'
        doc.formattedId = passportId
        documents.push(doc)
        addedIds.add(passportId)
      })
    }

    // Extract ID numbers
    const idNumbers = record.details?.id_numbers?.id || []
    if (Array.isArray(idNumbers)) {
      idNumbers.forEach((id: any) => {
        if (!id) {
          return
        }

        const idValue = typeof id === 'string' ? id : id['#text']
        if (!idValue || addedIds.has(idValue)) {
          return
        }

        const doc = new SanctionsIdDocument()
        doc.id = idValue
        doc.name = id['@_type'] || 'ID'
        doc.formattedId = idValue
        documents.push(doc)
        addedIds.add(idValue)
      })
    }

    return documents
  }

  private getAssociates(record: any): SanctionsAssociate[] {
    const associates: SanctionsAssociate[] = []

    // Extract linked_to UIDs (under details)
    const linkedTo = record.details?.linked_to?.uid || []
    if (Array.isArray(linkedTo)) {
      linkedTo.forEach((uid: any) => {
        if (!uid) {
          return
        }

        const uidRaw =
          typeof uid === 'string' || typeof uid === 'number'
            ? uid
            : uid['#text']
        const uidValue = uidRaw != null ? String(uidRaw) : undefined
        if (!uidValue) {
          return
        }

        const associate = new SanctionsAssociate()
        associate.id = uidValue
        associates.push(associate)
      })
    }

    // Extract company UIDs (under details)
    const companies = record.details?.companies?.company || []
    if (Array.isArray(companies)) {
      companies.forEach((company: any) => {
        if (!company) {
          return
        }

        const companyRaw =
          typeof company === 'string' || typeof company === 'number'
            ? company
            : company['#text']
        const companyId = companyRaw != null ? String(companyRaw) : undefined
        if (!companyId) {
          return
        }

        const associate = new SanctionsAssociate()
        associate.id = companyId
        associates.push(associate)
      })
    }

    return associates
  }

  private getSources(
    keywords: string[],
    specialInterestCategories: string[]
  ): {
    sanctionsSources: SanctionsSource[]
    mediaSources: SanctionsSource[]
    otherSources: SanctionsEntityOtherSources[]
  } {
    const sanctionsSources: SanctionsSource[] = []
    const mediaSources: SanctionsSource[] = []
    const regulatorySources: SanctionsSource[] = []

    // Process keywords for sanctions and regulatory enforcement lists
    keywords.forEach((keyword: string) => {
      const keywordInfo = this.keywords[keyword]
      if (keywordInfo) {
        if (keywordInfo.type === 'SANCTIONS') {
          const sourceInfo = keywordInfo
          sanctionsSources.push({
            name: sourceInfo.sourceName,
            fields: [{ name: 'Country', values: [sourceInfo.sourceCountry] }],
          })
        } else if (keywordInfo.type === 'REGULATORY_ENFORCEMENT_LIST') {
          const sourceInfo = keywordInfo
          regulatorySources.push({
            name: sourceInfo.sourceName,
            fields: [{ name: 'Country', values: [sourceInfo.sourceCountry] }],
          })
        }
      }
    })

    // Process special interest categories for adverse media
    specialInterestCategories.forEach((category: string) => {
      mediaSources.push({
        name: category,
      })
    })

    const otherSources: SanctionsEntityOtherSources[] = []
    if (regulatorySources.length > 0) {
      otherSources.push({
        type: 'REGULATORY_ENFORCEMENT_LIST',
        value: regulatorySources,
      })
    }

    return { sanctionsSources, mediaSources, otherSources }
  }

  private getScreeningSources(record: any): SanctionsSource[] {
    const sources: SanctionsSource[] = []
    const uris = record.details?.external_sources?.uri || []

    if (Array.isArray(uris)) {
      uris.forEach((uri: any) => {
        if (!uri) {
          return
        }

        const url = typeof uri === 'string' ? uri : uri['#text']
        if (!url) {
          return
        }

        sources.push({
          name: url,
          url: url,
          fields: [
            {
              name: 'URL',
              values: [url],
            },
          ],
        })
      })
    }

    return sources
  }

  private getAddresses(record: any): SanctionsEntityAddress[] {
    const addresses: SanctionsEntityAddress[] = []
    const locations = record.details?.locations?.location || []

    if (Array.isArray(locations)) {
      locations.forEach((location: any) => {
        if (!location) {
          return
        }

        const addressLine =
          typeof location === 'string' ? location : location['#text']
        const countryName = location['@_country']

        if (!addressLine && !countryName) {
          return
        }

        const address = new SanctionsEntityAddress()
        address.addressLine = addressLine || undefined
        address.city = location['@_city'] || undefined
        if (countryName) {
          address.country = LSEG_COUNTRY_CODES[countryName] as CountryCode
        }

        addresses.push(address)
      })
    }

    return addresses
  }

  private getCountries(codes): string[] {
    return compact(codes?.map((c) => COUNTRIES[c]))
  }

  private mapRecordToEntity(record: any): SanctionsEntity | null {
    if (!record || typeof record !== 'object') {
      return null
    }
    const uid = record['@_uid']
    const subCategory = record['@_sub-category']
    const keywords = (record.details?.keywords?.keyword || []).filter(
      (keyword: any) =>
        keyword && typeof keyword === 'string' && keyword['@_nil'] !== 'true'
    )
    // add check for @nil: "true" to special interest categories
    const specialInterestCategories = (
      record.details?.special_interest_categories?.special_interest_category ||
      []
    ).filter(
      (category: any) =>
        category && typeof category === 'object' && category['@_nil'] !== 'true'
    )
    const sanctionsSearchTypes = this.getSanctionsSearchType(
      subCategory,
      keywords,
      specialInterestCategories
    )

    // Extract person data
    const person = record.person

    const names = person?.names
    const firstName = names?.first_name || ''
    const lastName = names?.last_name || ''

    const originalName = `${firstName} ${lastName}`.trim()
    const aliasNodes = names?.aliases?.alias ?? []
    const aliasArray = Array.isArray(aliasNodes)
      ? aliasNodes
      : aliasNodes != null
      ? [aliasNodes]
      : []
    const aliasStrings: string[] = (aliasArray as any[])
      .map((a: any) => (typeof a === 'string' ? a : a?.['#text']))
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0)

    // Process LSEG names to handle both formats (firstName lastName and lastName,firstName)
    const processLSEGName = (name: string): string[] => {
      const normalized = name.toLowerCase().trim()
      if (!normalized) {
        return []
      }

      if (normalized.includes(',')) {
        const parts = normalized.split(',').map((p) => p.trim())
        const lastName = parts[0]
        const firstName = parts.slice(1).join(' ').trim()

        if (lastName && firstName) {
          // Reconstruct to "firstName lastName" and clean up any extra spaces
          return [`${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()]
        }
        // If format is invalid (e.g., "TRUMP," or ",DON"), return the cleaned-up non-comma version.
        return [normalized.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()]
      }

      return [normalized]
    }

    // Process original name and aliases to include all variants
    const allNames = [
      ...processLSEGName(originalName),
      ...aliasStrings.flatMap((alias) => processLSEGName(alias)),
    ]

    // Call getNameAndAka with all name variants
    const { name, aka, normalizedAka } = getNameAndAka(
      originalName.toLowerCase(),
      allNames
    )

    const singleDob = person?.agedata?.dob
    const dobsNode = person?.agedata?.dobs?.dob ?? []
    const dobNodes = [
      ...(singleDob !== undefined ? [singleDob] : []),
      ...(Array.isArray(dobsNode)
        ? dobsNode
        : dobsNode != null
        ? [dobsNode]
        : []),
    ]
    const dateOfBirths: string[] = dobNodes
      .map((dob: any) => (typeof dob === 'string' ? dob : dob?.['#text']))
      .filter((s: any): s is string => typeof s === 'string' && s.length > 0)
      .map((s: string) => dayjs(s).format('YYYY/MM/DD'))
    const yearOfBirth: string[] = dateOfBirths.map((s: string) =>
      dayjs(s).format('YYYY')
    )
    const deceasedNode = person?.agedata?.deceased
    const isDeceased =
      deceasedNode != null &&
      (deceasedNode['@_xsi:nil'] ?? deceasedNode['@_nil']) !== 'true'

    // Determine entity type based on e-i attribute
    const entityIndicator = person?.['@_e-i'] as string | undefined
    let entityType: SanctionsEntityType
    let gender: string | undefined
    if (entityIndicator === 'E') {
      entityType = 'BUSINESS'
    } else {
      entityType = 'PERSON'
      if (entityIndicator === 'M') {
        gender = Gender.MALE
      } else if (entityIndicator === 'F') {
        gender = Gender.FEMALE
      }
    }
    const countryCodes: CountryCode[] = []
    const rawCountries = record.details?.countries?.country || []
    const countriesArray = Array.isArray(rawCountries)
      ? rawCountries
      : rawCountries != null
      ? [rawCountries]
      : []
    for (const country of countriesArray) {
      const countryName =
        typeof country === 'string' ? country : country?.['#text']
      if (!countryName) {
        continue
      }
      const code = LSEG_COUNTRY_CODES[countryName] as CountryCode
      if (code) {
        countryCodes.push(code)
      }
    }

    const countries = this.getCountries(countryCodes)

    const citizenships = record.details?.citizenships?.citizenship || []
    const nationalityCodes: CountryCode[] = []
    const citizenshipsArray = Array.isArray(citizenships)
      ? citizenships
      : citizenships != null
      ? [citizenships]
      : []
    for (const citizenship of citizenshipsArray) {
      const citizenshipName =
        typeof citizenship === 'string' ? citizenship : citizenship?.['#text']
      if (!citizenshipName) {
        continue
      }
      const code = LSEG_COUNTRY_CODES[citizenshipName] as CountryCode
      if (code) {
        nationalityCodes.push(code)
      }
    }

    // Extract PEP information
    const pepRoleDetails = record.details?.pep_role_details
    const pepStatus = pepRoleDetails?.pep_status
    const isActivePep = pepStatus === 'active'
    const { occupations, pepSources, pepTypes } =
      this.getOccupationsAndPepDetails(pepRoleDetails, subCategory)

    // Extract sanctions information
    const isSanctioned = keywords.some(
      (keyword: any) =>
        keyword &&
        typeof keyword === 'string' &&
        (keyword.includes('SANCTIONS') ||
          keyword.includes('OFAC') ||
          keyword.includes('EU'))
    )

    // Extract documents
    const documents: SanctionsIdDocument[] = this.getDocuments(record)

    // Extract associates
    const associates: SanctionsAssociate[] = this.getAssociates(record)
    const { sanctionsSources, mediaSources, otherSources } = this.getSources(
      keywords,
      specialInterestCategories
    )

    // Extract screening sources
    const screeningSources: SanctionsSource[] = this.getScreeningSources(record)

    // Extract addresses
    const addresses: SanctionsEntityAddress[] = this.getAddresses(record)

    const entity: SanctionsEntity = {
      id: uid,
      gender: gender,
      name: name,
      entityType: entityType,
      sanctionSearchTypes: sanctionsSearchTypes,
      aka: aka,
      freetext: record.details?.further_information,
      documents: documents,
      occupations: occupations,
      associates: associates,
      types: [
        ...sanctionsSearchTypes.map((type) => humanizeAuto(type)),
        ...pepTypes,
      ],
      dateOfBirths: dateOfBirths,
      yearOfBirth: yearOfBirth,
      countries: countries,
      nationality: nationalityCodes,
      citizenship: nationalityCodes,
      countryCodes: countryCodes,
      isActivePep: isActivePep,
      isActiveSanctioned: isSanctioned,
      isDeseased: isDeceased,
      rawResponse: record,
      provider: this.provider(),
      keywords: keywords,
      addresses: addresses,
      updatedAt: Date.now(),
      normalizedAka: normalizedAka,
      screeningSources: screeningSources,
      sanctionsSources,
      pepSources,
      mediaSources,
      otherSources,
    }

    return entity
  }

  async processFeed(
    stream: Readable,
    repo: SanctionsRepository,
    version: string
  ) {
    logger.info('Starting LSEG feed processing...', { version })

    // Ensure keywords are loaded before processing
    logger.info('Loading LSEG keywords...')
    await this.ensureKeywordsLoaded()
    logger.info('Keywords loaded successfully', {
      keywordCount: Object.keys(this.keywords).length,
    })

    const gunzip = zlib.createGunzip()

    const BATCH_SIZE = 500
    let batch: [Action, SanctionsEntity][] = []
    let totalProcessed = 0

    const processBatch = async () => {
      if (batch.length > 0) {
        await repo.save(this.provider(), batch, version)
        totalProcessed += batch.length
        logger.info(`Processed ${totalProcessed} LSEG records.`)
        batch = []
      }
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      isArray: (tagName) => {
        return [
          'country',
          'citizenship',
          'id',
          'keyword',
          'alias',
          'passport',
          'uid',
          'company',
          'dob',
          'special_interest_category',
          'location',
          'uri',
        ].includes(tagName)
      },
    })

    try {
      const gunzippedStream = stream.pipe(gunzip)
      gunzippedStream.setEncoding('utf8')

      const recordStream = Readable.from(
        (async function* () {
          let xmlBuffer = ''
          let chunkCount = 0
          const recordTag = '</record>'

          for await (const chunk of gunzippedStream) {
            chunkCount++
            if (chunkCount % 1000 === 0) {
              logger.info('Processing stream chunks...', {
                chunkCount,
                bufferSize: xmlBuffer.length,
                totalProcessed,
              })
            }

            xmlBuffer += chunk
            let recordEndIndex
            while ((recordEndIndex = xmlBuffer.indexOf(recordTag)) !== -1) {
              const recordXmlWithPotentialPrefix = xmlBuffer.substring(
                0,
                recordEndIndex + recordTag.length
              )
              const recordStartIndex =
                recordXmlWithPotentialPrefix.lastIndexOf('<record')
              if (recordStartIndex !== -1) {
                const recordXml =
                  recordXmlWithPotentialPrefix.substring(recordStartIndex)
                yield recordXml
              }
              xmlBuffer = xmlBuffer.substring(recordEndIndex + recordTag.length)
            }
          }
          logger.info('Finished reading all stream chunks', {
            totalChunks: chunkCount,
            finalBufferSize: xmlBuffer.length,
          })
        })()
      )

      logger.info('Starting to process records from stream...')
      let recordCount = 0
      let parseErrorCount = 0
      const startTime = Date.now()

      for await (const recordXml of recordStream) {
        recordCount++
        if (recordCount % 1000 === 0) {
          const elapsedTime = Date.now() - startTime
          const recordsPerSecond = (recordCount / elapsedTime) * 1000
          logger.info('Processing records...', {
            recordCount,
            totalProcessed,
            parseErrorCount,
            elapsedTime: `${elapsedTime}ms`,
            recordsPerSecond: recordsPerSecond.toFixed(2),
          })
        }

        try {
          const recordJson = parser.parse(recordXml as string)
          const parsedRecord = Array.isArray(recordJson.record)
            ? recordJson.record[0]
            : recordJson.record
          const entity = this.mapRecordToEntity(parsedRecord)
          if (entity) {
            batch.push(['add', entity])
            if (batch.length >= BATCH_SIZE) {
              await processBatch()
            }
          }
        } catch (parseError) {
          parseErrorCount++
          logger.error('Error parsing individual record:', {
            error: String(parseError),
            recordCount,
            parseErrorCount,
            recordXml: recordXml.substring(0, 200) + '...', // Log only start of XML to avoid huge logs
          })
        }
      }

      logger.info('Processing final batch...', {
        remainingBatchSize: batch.length,
        totalRecords: recordCount,
        totalErrors: parseErrorCount,
      })
      await processBatch() // Process any remaining records
      logger.info(
        `Finished processing LSEG feed. Total records: ${totalProcessed}.`
      )
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Axios error during feed processing:', {
          message: error.message,
          status: error.response?.status,
          headers: error.response?.headers,
          data: error.response?.data,
        })
      } else {
        logger.error('Error processing LSEG feed:', error)
      }
      throw error
    }
  }
}
