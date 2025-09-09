import { Buffer } from 'buffer'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { pipeline } from 'stream'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import unzipper from 'unzipper'
import { compact, intersection, replace, uniq, uniqBy } from 'lodash'
import { decode } from 'html-entities'
import { COUNTRIES } from '@flagright/lib/constants'
import { MongoClient } from 'mongodb'
import { adverseMediaCategoryMap } from '@flagright/lib/utils/screening'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  getSanctionsSourceDocumentsCollectionName,
  normalizeSource,
} from '../utils'
import { MongoSanctionSourcesRepository } from '../repositories/sanction-source-repository'
import {
  apiEndpoint,
  PEP_RANK_DISTRIBUTION_BY_OCCUPATION_CODE,
  NATIONALITY_COUNTRY_TYPE,
  ADVERSE_MEDIA_DESCRIPTION3_VALUES,
  PERSON_ADVERSE_MEDIA_DESCRIPTION2_IDS,
  ENTITY_ADVERSE_MEDIA_DESCRIPTION2_IDS,
  ADVERSE_MEDIA_ID_TO_DESCRIPTION_MAP,
  FLOATING_CATEGORIES_DESCRIPTION_VALUES,
  NON_BUSINESS_CATEGORIES_DESCRIPTION_VALUES,
  LEVEL_TIER_MAP,
  ENTITY_SANCTIONS_DESCRIPTION2_VALUES,
  BANK_DESCRIPTION3_VALUES,
  ENTITY_ADVERSE_MEDIA_DESCRIPTION2_VALUES,
  RELATIONSHIP_CODE_TO_NAME,
  SANCTIONS_CATEGORY_MAP,
  PERSON_SANCTIONS_DESCRIPTION2_VALUES,
} from '../dow-jones-constants'
import { getNameAndAka } from './utils'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import {
  Action,
  SanctionsProviderResponse,
  SanctionsRepository,
  SanctionsSourceRepository,
} from '@/services/sanctions/providers/types'
import { logger } from '@/core/logger'
import dayjs, { convertDateFormat } from '@/utils/dayjs'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { removeUndefinedFields, generateHashFromString } from '@/utils/object'
import { DOW_JONES_COUNTRIES } from '@/services/sanctions/providers/dow-jones-countries'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { SanctionsIdDocument } from '@/@types/openapi-internal/SanctionsIdDocument'
import { SanctionsOccupation } from '@/@types/openapi-internal/SanctionsOccupation'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { traceable } from '@/core/xray'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { DowJonesSanctionsSearchType } from '@/@types/openapi-internal/DowJonesSanctionsSearchType'
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/DowJonesSanctionsSearchType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'
import { tenantSettings } from '@/core/utils/context'
import { DowJonesAdverseMediaSourceRelevance } from '@/@types/openapi-internal/DowJonesAdverseMediaSourceRelevance'
import { SourceDocument } from '@/@types/openapi-internal/SourceDocument'

// Define the XML parser
export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (tagName) => {
    return [
      'Name',
      'NameValue',
      'Date',
      'Country',
      'PublicFigure',
      'Associate',
      'Person',
      'Source',
      'SourceDescription',
      'Description',
      'Descriptions',
      'IDNumberTypes',
      'IDValue',
      'ID',
      'Roles',
      'RoleDetail',
      'OccTitle',
      'SanctionsReferences',
      'Entity',
    ].includes(tagName)
  },
})

const pipelineAsync = promisify(pipeline)

@traceable
export class DowJonesProvider extends SanctionsDataFetcher {
  authHeader: string
  private screeningTypes: DowJonesSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]
  private sanctionsSourceToEntityCountPerson: Map<string, number> = new Map()
  private sanctionsSourceToEntityCountBusiness: Map<string, number> = new Map()
  private pepSourceToEntityCountPerson: Map<string, number> = new Map()
  private sourceNameToHash: Map<string, string> = new Map()

  static async build(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    const settings = await tenantSettings(tenantId)
    const dowJonesSettings = settings?.sanctions?.providerScreeningTypes?.find(
      (type) => type.provider === SanctionsDataProviders.DOW_JONES
    )
    const sanctions = settings?.sanctions
    let types: DowJonesSanctionsSearchType[] | undefined
    let entityTypes: SanctionsEntityType[] | undefined
    if (dowJonesSettings) {
      types = dowJonesSettings?.screeningTypes as DowJonesSanctionsSearchType[]
      entityTypes = dowJonesSettings?.entityTypes as SanctionsEntityType[]
    }
    if (
      sanctions?.dowjonesCreds?.password &&
      sanctions?.dowjonesCreds?.username
    ) {
      return new DowJonesProvider(
        sanctions.dowjonesCreds.username,
        sanctions.dowjonesCreds.password,
        tenantId,
        types ?? DOW_JONES_SANCTIONS_SEARCH_TYPES,
        entityTypes ?? SANCTIONS_ENTITY_TYPES,
        connections
      )
    }
    throw new Error(`No credentials found for Dow Jones for tenant ${tenantId}`)
  }

  constructor(
    username: string,
    password: string,
    tenantId: string,
    screeningTypes: DowJonesSanctionsSearchType[],
    entityTypes: SanctionsEntityType[],
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    super(SanctionsDataProviders.DOW_JONES, tenantId, connections)
    this.authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
    this.screeningTypes = screeningTypes
    this.entityTypes = entityTypes
  }

  private async saveSourceMapsToCollection(
    repo: SanctionsSourceRepository,
    version: string
  ) {
    const sourceDocuments: [Action, SourceDocument][] = []

    // Process sanctions sources for persons
    for (const [
      displayName,
      count,
    ] of this.sanctionsSourceToEntityCountPerson.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds: [], // Keep empty as requested
          entityCount: count,
          entityType: 'PERSON',
          sourceType: 'SANCTIONS',
          sourceCountry: undefined,
          displayName: displayName,
          id: this.sourceNameToHash.get(sourceName),
        },
      ])
    }

    // Process sanctions sources for businesses
    for (const [
      displayName,
      count,
    ] of this.sanctionsSourceToEntityCountBusiness.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds: [], // Keep empty as requested
          entityCount: count,
          entityType: 'BUSINESS',
          sourceType: 'SANCTIONS',
          sourceCountry: undefined,
          displayName: displayName,
          id: this.sourceNameToHash.get(sourceName),
        },
      ])
    }

    // Process PEP sources
    for (const [
      displayName,
      count,
    ] of this.pepSourceToEntityCountPerson.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds: [], // Keep empty as requested
          entityCount: count,
          entityType: 'PERSON',
          sourceType: 'PEP',
          displayName: displayName,
          id: this.sourceNameToHash.get(sourceName),
        },
      ])
    }

    // Save all documents at once (since we know there won't be more than 4000)
    if (sourceDocuments.length > 0) {
      await repo.save(
        SanctionsDataProviders.DOW_JONES,
        sourceDocuments,
        version
      )
      logger.info(
        `Saved ${sourceDocuments.length} source documents to collection`
      )
    }

    this.sanctionsSourceToEntityCountPerson.clear()
    this.sanctionsSourceToEntityCountBusiness.clear()
    this.pepSourceToEntityCountPerson.clear()
  }

  async fullLoad(repo: SanctionsRepository, version: string) {
    const filePaths = (await this.getFilePaths()).sort()
    const indexOfLatestFullLoadFile = filePaths
      .map((str, index) => (str.includes('_f_splits.zip') ? index : -1))
      .filter((index) => index !== -1)
      .pop()
    const filesFromFullLoad = filePaths
      .slice(indexOfLatestFullLoadFile)
      .filter((fp) => fp.includes('_f_splits.zip') || fp.includes('_d.zip'))

    const sourceDocumentsRepo = new MongoSanctionSourcesRepository(
      this.mongoDb,
      getSanctionsSourceDocumentsCollectionName(
        [SanctionsDataProviders.DOW_JONES],
        this.tenantId
      )
    )

    for (const file of filesFromFullLoad) {
      const outputDir = await this.downloadZip(file)
      const isSplit = file.includes('_f_splits.zip')
      if (isSplit) {
        await this.processSplitArchive(
          repo,
          sourceDocumentsRepo,
          version,
          outputDir
        )
      } else {
        await this.processSingleFile(
          repo,
          sourceDocumentsRepo,
          version,
          outputDir
        )
      }
    }
    await this.saveSourceMapsToCollection(sourceDocumentsRepo, version)
  }

  async delta(repo: SanctionsRepository, version: string, from: Date) {
    const filePaths = (await this.getFilePaths()).sort()

    const filteredFiles = filePaths.filter((fp) => {
      const timestamp = fp.split('_')[1]

      return (
        timestamp > dayjs(from).format('YYYYMMDDHHmm') && fp.includes('_d.zip')
      )
    })

    const sourceDocumentsRepo = new MongoSanctionSourcesRepository(
      this.mongoDb,
      getSanctionsSourceDocumentsCollectionName(
        [SanctionsDataProviders.DOW_JONES],
        this.tenantId
      )
    )
    for (const file of filteredFiles) {
      const outputDir = await this.downloadZip(file)
      await this.processSingleFile(
        repo,
        sourceDocumentsRepo,
        version,
        outputDir
      )
    }
    await this.saveSourceMapsToCollection(sourceDocumentsRepo, version)
  }
  // Function to get the list of file paths
  async getFilePaths(): Promise<string[]> {
    try {
      const response = await axios.get(apiEndpoint, {
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/xml',
        },
      })
      return response.data.split(',')
    } catch (error) {
      logger.error('Error fetching file paths:', error)
      throw error
    }
  }

  // Function to read and parse an XML file
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8')
  }

  async downloadZip(filePath: string): Promise<string> {
    logger.info(`Downloading file ${filePath}`)

    const outputPath = path.join('/tmp', 'downloaded_files', filePath)
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })

    const outputDir = path.join(
      '/tmp',
      'unzipped_files',
      path.basename(outputPath, '.zip')
    )
    await fs.promises.mkdir(outputDir, { recursive: true })

    const response = await axios.get(`${apiEndpoint}/${filePath}`, {
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/zip',
      },
      responseType: 'stream',
    })

    logger.info(`Streaming and unzipping file ${filePath}`)
    await pipelineAsync(response.data, unzipper.Extract({ path: outputDir }))

    logger.info(`${filePath} extracted`)

    return outputDir
  }
  async processSplitArchive(
    repo: SanctionsRepository,
    sourceDocumentsRepo: SanctionsSourceRepository,
    version: string,
    rootDir: string
  ) {
    logger.info(`Processing ${rootDir}`)
    // Jump down two directories which are something like Factiva_PFA_Feed_XML/PFA2_202408312200_F_Splits
    const factivaPfaFeedDir = fs
      .readdirSync(rootDir)
      .filter((f) => fs.statSync(path.join(rootDir, f)).isDirectory())[0]
    const pfaSplitsDir = fs
      .readdirSync(path.join(rootDir, factivaPfaFeedDir))
      .filter((f) =>
        fs.statSync(path.join(rootDir, factivaPfaFeedDir, f)).isDirectory()
      )[0]
    const outputDir = path.join(rootDir, factivaPfaFeedDir, pfaSplitsDir)

    const masterFiles = await this.listFilePaths(`${outputDir}/Masters`)
    const masterContext = masterFiles.reduce<object>((acc, masterFile) => {
      const xml = this.readFile(masterFile)
      const jsonObj = parser.parse(xml)
      const onlyKey = Object.keys(jsonObj.PFA)[0]
      return { ...acc, [onlyKey]: this.mapToContextItem(jsonObj.PFA[onlyKey]) }
    }, {})

    this.checkContext(masterContext)

    const files = (
      await Promise.all([
        this.listFilePaths(`${outputDir}/Person`),
        this.listFilePaths(`${outputDir}/Entity`),
      ])
    ).flat()
    for (const peopleFile of files) {
      const xml = this.readFile(peopleFile)
      logger.info(`Processing ${peopleFile}`)
      await this.fileToEntities(
        repo,
        sourceDocumentsRepo,
        version,
        xml,
        masterContext
      )
    }
    const associationFiles = (
      await Promise.all([
        this.listFilePaths(`${outputDir}/Person_Associations`),
        this.listFilePaths(`${outputDir}/Entity_Associations`),
      ])
    ).flat()
    for (const associationFile of associationFiles) {
      const xml = this.readFile(associationFile)
      const jsonObj = parser.parse(xml)
      logger.info(`Processing ${associationFile}`)
      await this.processAssociations(
        repo,
        sourceDocumentsRepo,
        version,
        jsonObj.PFA
      )
    }
  }

  async processSingleFile(
    repo: SanctionsRepository,
    sourceDocumentsRepo: SanctionsSourceRepository,
    version: string,
    filepath: string
  ) {
    logger.info(`Processing ${filepath}`)
    // Jump down two directories which are something like Factiva_PFA_Feed_XML
    const pfaSplitsDir = fs
      .readdirSync(filepath)
      .filter((f) => fs.statSync(path.join(filepath, f)).isDirectory())[0]

    const rootDir = path.join(filepath, pfaSplitsDir)

    const peopleFiles = await this.listFilePaths(rootDir)
    if (peopleFiles.length == 0) {
      logger.info(`No files in ${rootDir}`)
      return
    }
    await Promise.all(
      peopleFiles.map(async (peopleFile) => {
        logger.info(`Processing ${peopleFile}`)
        const xml = this.readFile(peopleFile)
        const jsonObj = parser.parse(xml)
        const contextItems = [
          'Country',
          'DateType',
          'Description1',
          'Description2',
          'Description3',
          'NameType',
          'Occupation',
          'Relationship',
          'RoleType',
          'SanctionsReferences',
        ].reduce((acc, ci) => {
          const rootKey = `${ci}List`
          const root = jsonObj.PFA[rootKey]
          acc[rootKey] = this.mapToContextItem(root)
          return acc
        }, {})

        this.checkContext(contextItems)
        await this.fileToEntities(
          repo,
          sourceDocumentsRepo,
          version,
          xml,
          contextItems
        )
      })
    )
    await Promise.all(
      peopleFiles.map(async (peopleFile) => {
        const xml = this.readFile(peopleFile)
        const jsonObj = parser.parse(xml)
        await this.processAssociations(
          repo,
          sourceDocumentsRepo,
          version,
          jsonObj.PFA.Associations
        )
      })
    )
  }

  private mapToContextItem(contextItemRoot: any) {
    const onlyKey = Object.keys(contextItemRoot)[0]
    const idMap = {
      CountryName: '@_code',
      DateType: '@_Id',
      Description1Name: '@_Description1Id',
      Description2Name: '@_Description2Id',
      Description3Name: '@_Description3Id',
      NameType: '@_NameTypeID',
      Occupation: '@_code',
      Relationship: '@_code',
      RoleType: '@_Id',
      ReferenceName: '@_code',
    }

    const contextItems = contextItemRoot[onlyKey].reduce(
      (acc: any, item: any) => {
        acc[item[idMap[onlyKey]]] = item
        return acc
      },
      {}
    )

    return contextItems
  }

  private checkContext(ctx: any) {
    // Integrity checks
    const missingCountry = Object.keys(ctx.CountryList).filter(
      (code) => DOW_JONES_COUNTRIES[code] === undefined
    )
    if (missingCountry.length > 0) {
      const message = `You will need to update the DOW_JONES_COUNTRIES enum. These dow jones countries are not up to date: ${missingCountry.join(
        ', '
      )}.`
      logger.error(message)
    }

    if (ctx.RoleTypeList.length === 26) {
      logger.error(
        'The role type list from dow jones has changed, you will need to update the OccuptionRole enum'
      )
    }
  }

  private async processAssociations(
    repo: SanctionsRepository,
    sourceDocumentsRepo: SanctionsSourceRepository,
    version: string,
    root: any
  ) {
    const publicFigures = root.PublicFigure || []
    const associations = publicFigures.map((pf) => {
      return [
        pf['@_id'],
        pf.Associate.map((a: any) => ({
          id: a['@_id'],
          association: a['@_code'],
        })),
      ]
    })
    const displayName = LEVEL_TIER_MAP.PEP_BY_ASSOCIATIONS
    for (const _association of associations) {
      const currentCount =
        this.pepSourceToEntityCountPerson.get(displayName) || 0
      this.pepSourceToEntityCountPerson.set(displayName, currentCount + 1)
    }
    const sourceName = normalizeSource(displayName)
    this.sourceNameToHash.set(
      sourceName,
      generateHashFromString(sourceName, 16)
    )
    if (associations.length) {
      await repo.saveAssociations(this.provider(), associations, version)
    }
  }

  async fileToEntities(
    repo: SanctionsRepository,
    sourceDocumentsRepo: SanctionsSourceRepository,
    version: string,
    xml: string,
    masters: any
  ) {
    // We make assumptions on description1 being static so we can map to PEP, Sanctions or Adverse to media.
    // If description1 changes we need to know
    if (Object.keys(masters.Description1List).length !== 4) {
      logger.error(
        'DowJones Description 1 has changed, meaning our mapping to PEP/Sanctions/Adverse may be incorrect'
      )
    }

    const jsonObj = parser.parse(xml)
    const people = jsonObj.PFA.Person ?? jsonObj.PFA.Records?.Person ?? []
    const entities = jsonObj.PFA.Entity ?? jsonObj.PFA.Records?.Entity ?? []

    const updates = [
      ...this.peopleToSanctionEntity(people, masters),
      ...this.entitiesToSanctionEntity(entities, masters),
    ]
    if (updates.length) {
      await repo.save(this.provider(), updates, version)
    }
  }

  private isInactivePEP(date: any, dateType: string) {
    const currentYear = dayjs().year()
    return (
      date['@_DateType'] === dateType &&
      date['DateValue'] &&
      date['DateValue']['@_Year'] &&
      currentYear - dayjs(date['DateValue']['@_Year']).year() > 7
    )
  }

  private isActiveSanctioned(sanctionsReferences) {
    return Boolean(
      this.getActiveSanctionReferences(sanctionsReferences)?.length
    )
  }

  private getActiveSanctionReferences(sanctionsReferences) {
    return (
      sanctionsReferences
        ?.flatMap((sr) => sr?.Reference)
        .filter(
          (sr) => !sr['@_toDay'] && !sr['@_toMonth'] && !sr['@_toYear']
        ) ?? []
    )
  }

  private getScreeningTypesForPerson(person): {
    pepRcaMatchTypes: string[]
    sanctionSearchTypes: DowJonesSanctionsSearchType[]
    screeningProfileTypes: DowJonesSanctionsSearchType[]
  } {
    const sanctionsReferences = this.getActiveSanctionReferences(
      person.SanctionsReferences
    )

    const inactiveRCA = Boolean(
      person.DateDetails?.Date?.find((date: any) =>
        this.isInactivePEP(date, 'Inactive as of (RCA related to PEP)')
      )
    )

    const sanctionSearchTypes: DowJonesSanctionsSearchType[] = []
    const screeningProfileTypes: DowJonesSanctionsSearchType[] = []
    const descriptions = this.getDescriptions(person)
    const descriptionValues = descriptions
      ?.map((d) => d['@_Description1'])
      .filter(Boolean)
    const pepRcaMatchTypes: string[] = []
    const description2Values = descriptions
      ?.map((d) => d['@_Description2'])
      .filter(Boolean)
    if (
      descriptionValues?.includes('1') &&
      this.screeningTypes.includes('PEP')
    ) {
      sanctionSearchTypes.push('PEP')
      pepRcaMatchTypes.push('PEP')
    }
    if (
      descriptionValues?.includes('2') &&
      !inactiveRCA &&
      this.screeningTypes.includes('PEP')
    ) {
      pepRcaMatchTypes.push('RCA')
    }
    if (descriptionValues?.includes('3')) {
      if (['1'].some((val) => description2Values?.includes(val))) {
        sanctionSearchTypes.push('SANCTIONS')
      }
      if (
        PERSON_SANCTIONS_DESCRIPTION2_VALUES.some((val) =>
          description2Values?.includes(val)
        )
      ) {
        screeningProfileTypes.push('SANCTIONS')
      }
      if (
        [...ADVERSE_MEDIA_DESCRIPTION3_VALUES, '2', '25'].some((val) =>
          description2Values?.includes(val)
        )
      ) {
        sanctionSearchTypes.push('ADVERSE_MEDIA')
      }
      if (
        FLOATING_CATEGORIES_DESCRIPTION_VALUES.some((val) =>
          description2Values?.includes(val)
        )
      ) {
        screeningProfileTypes.push('ADVERSE_MEDIA')
      }
    }
    if (descriptionValues?.includes('4')) {
      if (
        ENTITY_SANCTIONS_DESCRIPTION2_VALUES.some((val) =>
          description2Values?.includes(val)
        ) &&
        (!sanctionsReferences || sanctionsReferences.length > 0)
      ) {
        sanctionSearchTypes.push('SANCTIONS')
      }
      if (
        FLOATING_CATEGORIES_DESCRIPTION_VALUES.some((val) =>
          description2Values?.includes(val)
        )
      ) {
        sanctionSearchTypes.push('ADVERSE_MEDIA')
      }
    }
    return {
      sanctionSearchTypes: intersection(
        sanctionSearchTypes,
        this.screeningTypes
      ),
      pepRcaMatchTypes,
      screeningProfileTypes: intersection(
        screeningProfileTypes,
        this.screeningTypes
      ),
    }
  }

  private getDescriptions(entity) {
    return entity.Descriptions?.flatMap((d) => d.Description)
  }
  private getCountryCodes(entity, isNationality?: boolean): CountryCode[] {
    let countryCodes: CountryCode[]
    if (isNationality) {
      countryCodes = compact(
        entity.CountryDetails?.Country?.filter((c) =>
          NATIONALITY_COUNTRY_TYPE.includes(c['@_CountryType'])
        )?.map((c) => DOW_JONES_COUNTRIES[c.CountryValue?.['@_Code'] as string])
      )
    }
    countryCodes = compact(
      entity.CountryDetails?.Country?.map(
        (c) => DOW_JONES_COUNTRIES[c.CountryValue?.['@_Code'] as string]
      )
    )
    return uniq(countryCodes)
  }

  private getCountries(codes): string[] {
    return compact(codes?.map((c) => COUNTRIES[c]))
  }

  private getDocuments(idNumberTypes) {
    return uniqBy<SanctionsIdDocument>(
      idNumberTypes?.flatMap((id) =>
        id.ID?.flatMap((id): SanctionsIdDocument => {
          return id.IDValue?.map((idValue) => {
            const idVal = String(idValue['#text'] ?? idValue)
            return {
              id: idVal,
              name: id['@_IDType'],
              formattedId: idValue ? replace(idVal, /-/g, '') : idVal,
            }
          })
        })
      ),
      'id'
    )
  }

  private getRoles(roleDetails, previous?: boolean) {
    if (previous === true) {
      return roleDetails
        ?.flatMap((rd) =>
          rd.Roles.filter((r) => r['@_RoleType'] === 'Previous Roles')
        )
        .flatMap((r) => r.OccTitle)
    }
    if (previous === false) {
      return roleDetails?.flatMap((rd) =>
        rd.Roles.filter((r) => r['@_RoleType'] != 'Previous Roles').flatMap(
          (r) => r.OccTitle
        )
      )
    }
    return roleDetails?.flatMap((rd) => rd.Roles.flatMap((r) => r.OccTitle))
  }

  private getOccupations(roleDetails) {
    const previousRoles = this.getRoles(roleDetails, true)
      ?.map((role) => role['#text'])
      ?.join(', ')

    const occupations = this.getRoles(roleDetails, false)?.map(
      (role): SanctionsOccupation => {
        return {
          title:
            role['#text'] === 'See Previous Roles'
              ? previousRoles
              : role['#text'],
          occupationCode:
            PEP_RANK_DISTRIBUTION_BY_OCCUPATION_CODE[role['@_OccCat']]
              ?.occupationCode,
          rank: PEP_RANK_DISTRIBUTION_BY_OCCUPATION_CODE[role['@_OccCat']]
            ?.rank,
        }
      }
    )
    return occupations
  }

  private getNames(names, primary?: boolean): string[] | undefined {
    if (primary) {
      const name = names.find((n) => n['@_NameType'] === 'Primary Name')
      if (!name) {
        return undefined
      }
      return [this.getNameValue(name.NameValue[0])]
    }
    return compact(
      names
        .filter((n) => n['@_NameType'] !== 'Primary Name')
        .flatMap((name) => name.NameValue)
        ?.map((n) => {
          const name = this.getNameValue(n)
          if (name && name.length > 0) {
            return decode(name)
          }
          return undefined
        })
    )
  }

  private getSourceDescriptions(sourceDescription) {
    return sourceDescription
      ?.flatMap((sd) => sd.Source)
      ?.map((sd): SanctionsSource => {
        const result = sd['@_name'].split(',')

        if (result.length == 1) {
          return {
            name: sd['@_name'],
          }
        }
        const [name, createdAt, source] = result
        let url: string | undefined
        if (source) {
          const urlPattern = /https?:\/\/[^\s]+/
          const urls = source.match(urlPattern)
          url = urls ? urls[0] : undefined
          if (url && url.endsWith(')')) {
            url = url.slice(0, -1)
          }
        }

        const [day, month, year] = createdAt.split('-')
        const parsedDate = new Date(
          Date.UTC(
            parseInt(year),
            new Date(`${month} 1, 2024`).getMonth(),
            parseInt(day)
          )
        )
        return {
          name,
          createdAt: parsedDate.valueOf(),
          url,
          fields: url
            ? [
                {
                  name: 'URL',
                  values: [url],
                },
              ]
            : [],
        }
      })
  }

  private getYearFromDates(date, dateType) {
    const yearOfBirth = uniq(
      compact(
        date?.flatMap((d) =>
          d['@_DateType'] === dateType
            ? Array.isArray(d.DateValue)
              ? d.DateValue.map((v) => v['@_Year'])
              : d.DateValue?.['@_Year'] ?? ''
            : []
        )
      )
    ) as string[]
    return yearOfBirth.length ? yearOfBirth : undefined
  }

  private getFormattedDates(date, dateType: string) {
    return uniq(
      compact(
        date?.flatMap((d) =>
          d['@_DateType'] === dateType
            ? Array.isArray(d.DateValue)
              ? d.DateValue.map((v) => {
                  const {
                    '@_Day': day = '',
                    '@_Month': month = '',
                    '@_Year': year = '',
                  } = v
                  return convertDateFormat(year, month, day)
                })
              : (() => {
                  const {
                    '@_Day': day = '',
                    '@_Month': month = '',
                    '@_Year': year = '',
                  } = d.DateValue || {}
                  return convertDateFormat(year, month, day)
                })()
            : []
        )
      )
    ) as string[]
  }

  private peopleToSanctionEntity(people, masters): [Action, SanctionsEntity][] {
    if (!people || !this.entityTypes.includes('PERSON')) {
      return []
    }

    return compact(
      people.map((person: any): [Action, SanctionsEntity] | undefined => {
        if (person['@_action'] == 'del') {
          return [
            'del',
            {
              id: person['@_id'],
              name: '',
              entityType: 'PERSON',
            },
          ]
        }
        const sanctionsReferencesList = masters.SanctionsReferencesList
        const relationshipCodeToName = Object.fromEntries(
          Object.entries(masters.RelationshipList).map(([key, value]: any) => [
            key,
            value['@_name'],
          ])
        )
        // Merging with RELATIONSHIP_CODE_TO_NAME to avoid loss of previous data
        Object.assign(RELATIONSHIP_CODE_TO_NAME, relationshipCodeToName)
        const descriptions = this.getDescriptions(person)
        const { sanctionSearchTypes, pepRcaMatchTypes, screeningProfileTypes } =
          this.getScreeningTypesForPerson(person)

        const name = this.getNames(person.NameDetails?.Name, true)?.[0]
        if (!name) {
          return
        }
        const isActivePep = !person.DateDetails?.Date?.find((date: any) =>
          this.isInactivePEP(date, 'Inactive as of (PEP)')
        )
        const countryCodes = this.getCountryCodes(person)
        const countries = this.getCountries(countryCodes)
        const countryOfNationality = this.getCountryCodes(person, true)

        const documents = this.getDocuments(person.IDNumberTypes)
        const occupations = this.getOccupations(person.RoleDetail)
        const {
          name: normalizedName,
          aka,
          normalizedAka,
        } = getNameAndAka(
          name.toLowerCase(),
          compact(this.getNames(person.NameDetails?.Name)).map((n) =>
            n.toLowerCase()
          )
        )

        const referenceNumbersToReferenceNameMap =
          this.referenceNumbersToReferenceNameMap(
            person,
            sanctionsReferencesList
          )
        const sanctionsSources: SanctionsSource[] = []
        const pepSources: SanctionsSource[] = []
        const mediaSources: SanctionsSource[] = []

        for (const screeningProfileType of screeningProfileTypes) {
          if (screeningProfileType === 'ADVERSE_MEDIA') {
            const adverseMediaTypes = this.getAdverseMediaForPerson(person)
            for (const adverseMediaType of adverseMediaTypes) {
              const category = adverseMediaCategoryMap[adverseMediaType]
              if (category) {
                mediaSources.push({
                  category: category,
                  createdAt: Date.now(),
                  internalId: generateHashFromString(category, 16),
                })
              }
            }
          }
          if (screeningProfileType === 'SANCTIONS') {
            const newSanctionsSources = this.getSanctionsSources(
              person.SanctionsReferences,
              sanctionsReferencesList,
              PERSON_SANCTIONS_DESCRIPTION2_VALUES
            )
            sanctionsSources.push(...newSanctionsSources)
          }
          if (screeningProfileType === 'PEP') {
            const newPepSources = this.getPepSources(occupations)
            pepSources.push(...newPepSources)
          }
        }
        const entity: SanctionsEntity = {
          id: person['@_id'],
          name: normalizedName,
          entityType: 'PERSON',
          matchTypes: [
            ...pepRcaMatchTypes,
            ...(descriptions
              ?.map((d) => {
                return this.getDescriptionsSpecific(d, masters, [2])?.[0]
              })
              .filter(Boolean) ?? []),
          ],
          freetext: person.ProfileNotes,
          documents,
          sanctionSearchTypes,
          occupations,
          types: compact([
            ...(descriptions?.map((d) =>
              this.getDescriptionsSpecific(d, masters, [1, 2, 3]).join(' - ')
            ) || []),
            ...(referenceNumbersToReferenceNameMap ?? []),
          ]),
          screeningSources: this.getSourceDescriptions(
            person.SourceDescription
          ),
          sanctionsSources,
          mediaSources,
          pepSources,
          gender: person.Gender,
          dateMatched: true,
          aka,
          normalizedAka,
          rawResponse: person,
          countries,
          nationality: countryOfNationality,
          countryCodes,
          yearOfBirth: this.getYearFromDates(
            person.DateDetails?.Date,
            'Date of Birth'
          ),

          dateOfBirths: this.getFormattedDates(
            person.DateDetails?.Date,
            'Date of Birth'
          ),
          profileImagesUrls: person.Images?.Image
            ? Array.isArray(person.Images.Image)
              ? person.Images.Image.map((img) => img['@_URL'])
              : [person.Images.Image['@_URL']]
            : undefined,
          isActivePep,
          isActiveSanctioned: this.isActiveSanctioned(
            person.SanctionsReferences
          ),
          aggregatedSourceIds: compact(
            uniq([
              ...sanctionsSources
                .filter((s) => s.sourceName && s.category)
                .map((s) => `${s.internalId}-${s.category}`),
              ...pepSources
                .filter((s) => s.sourceName && s.category === 'PEP')
                .map((s) => `${s.internalId}-PEP`),
              ...mediaSources.map((s) => s.category),
            ])
          ),
        }

        return [
          person['@_action'] as Action,
          removeUndefinedFields(entity) as SanctionsEntity,
        ]
      })
    )
  }

  private getDescriptionsSpecific(
    description,
    masters,
    descriptionsToInclude: number[]
  ) {
    return compact([
      description['@_Description1'] && descriptionsToInclude.includes(1)
        ? masters.Description1List[description['@_Description1']]['#text']
        : undefined,
      description['@_Description2'] && descriptionsToInclude.includes(2)
        ? masters.Description2List[description['@_Description2']]['#text']
        : undefined,
      description['@_Description3'] && descriptionsToInclude.includes(3)
        ? masters.Description3List[description['@_Description3']]['#text']
        : undefined,
    ])
  }

  private referenceNumbersToReferenceNameMap(person, sanctionsReferencesList) {
    let referenceNumbers: string[] = []
    if (person['SanctionsReferences']) {
      referenceNumbers = uniq(
        person['SanctionsReferences']
          .map((sanctionRef) => {
            const ref = sanctionRef['Reference']
            if (Array.isArray(ref)) {
              return ref.map((r) => (typeof r === 'object' ? r['#text'] : r))
            }
            return ref?.['#text']
          })
          .flat()
          .filter(Boolean)
      )
      return referenceNumbers
        .map((ref) => sanctionsReferencesList[ref]?.['@_name'])
        .filter(Boolean)
    }
  }

  private isBank(description2Values, description3Values) {
    return (
      description2Values.some((d) =>
        ENTITY_SANCTIONS_DESCRIPTION2_VALUES.includes(d)
      ) && description3Values.some((d) => BANK_DESCRIPTION3_VALUES.includes(d))
    )
  }

  private isBusiness(description2Values, description3Values) {
    return (
      description2Values.some((d) =>
        ENTITY_SANCTIONS_DESCRIPTION2_VALUES.includes(d)
      ) &&
      description3Values.every(
        (d) => !NON_BUSINESS_CATEGORIES_DESCRIPTION_VALUES.includes(d)
      )
    )
  }

  private getEntityType(descriptions): SanctionsEntityType | undefined {
    const description2Values = compact(
      descriptions?.map((d) => d['@_Description2'])
    )
    const description3Values = compact(
      descriptions?.map((d) => d['@_Description3'])
    )
    const isBank = this.isBank(description2Values, description3Values)
    if (isBank && this.entityTypes.includes('BANK')) {
      return 'BANK'
    }
    if (
      this.isBusiness(description2Values, description3Values) &&
      this.entityTypes.includes('BUSINESS') &&
      !isBank
    ) {
      return 'BUSINESS'
    }
    return undefined
  }

  private getEntityNames(names, primary?: boolean): string[] | undefined {
    if (primary) {
      const nameValues = names?.filter(
        (name) => name['@_NameType'] === 'Primary Name'
      )
      if (!nameValues?.length) {
        return undefined
      }
      return nameValues.flatMap((val) =>
        val['NameValue']?.map((v) => this.getEntityNameValue(v))
      )
    }
    const nameValues = names?.filter(
      (name) => name['@_NameType'] !== 'Primary Name'
    )
    if (!nameValues?.length) {
      return undefined
    }
    return uniq(
      compact(
        nameValues.flatMap((val) =>
          val['NameValue']?.map((v) => this.getEntityNameValue(v))
        )
      )
    )
  }

  private getEntityNameValue(nameValue) {
    let name = ''
    if (nameValue['EntityName']) {
      name = nameValue['EntityName']
    }
    if (nameValue['Suffix']) {
      name = name + ' ' + nameValue['Suffix']
    }
    return String(name).trim()
  }

  private getEntitySanctionsSearchType(entity): DowJonesSanctionsSearchType[] {
    const descriptions = this.getDescriptions(entity)
    const description2Values = compact(
      descriptions?.map((d) => d['@_Description2'])
    ) as string[]
    const sanctionsSearchTypes: DowJonesSanctionsSearchType[] = []
    if (
      description2Values?.some((d) =>
        ENTITY_SANCTIONS_DESCRIPTION2_VALUES.includes(d)
      )
    ) {
      sanctionsSearchTypes.push('SANCTIONS')
    }
    if (
      description2Values?.some((d) =>
        ENTITY_ADVERSE_MEDIA_DESCRIPTION2_VALUES.includes(d)
      )
    ) {
      sanctionsSearchTypes.push('ADVERSE_MEDIA')
    }
    return intersection(sanctionsSearchTypes, this.screeningTypes)
  }

  private entitiesToSanctionEntity(
    entities,
    masters
  ): [Action, SanctionsEntity][] {
    if (!entities) {
      return []
    }

    return compact(
      entities.map((entity: any): [Action, SanctionsEntity] | undefined => {
        if (entity['@_action'] == 'del') {
          return [
            'del',
            {
              id: entity['@_id'],
              name: '',
              entityType: 'BUSINESS',
            },
          ]
        }

        const descriptions = this.getDescriptions(entity)

        const name = this.getEntityNames(entity.NameDetails.Name, true)?.[0]
        const sanctionSearchTypes: DowJonesSanctionsSearchType[] =
          this.getEntitySanctionsSearchType(entity)
        const entityType = this.getEntityType(this.getDescriptions(entity))
        if (!name || !entityType || !this.entityTypes.includes(entityType)) {
          return
        }

        const countryCodes = this.getCountryCodes(entity)
        const countries = this.getCountries(countryCodes)
        const countryOfNationality = this.getCountryCodes(entity, true)

        const documents = this.getDocuments(entity.IDNumberTypes)
        const {
          name: normalizedName,
          aka,
          normalizedAka,
        } = getNameAndAka(
          name.toLowerCase(),
          compact(this.getEntityNames(entity.NameDetails.Name)).map((n) =>
            n.toLowerCase()
          )
        )

        const sanctionsSources: SanctionsSource[] = []
        const mediaSources: SanctionsSource[] = []

        for (const sanctionSearchType of sanctionSearchTypes) {
          if (sanctionSearchType === 'ADVERSE_MEDIA') {
            const adverseMediaTypes = this.getAdverseMediaForEntity(entity)
            for (const adverseMediaType of adverseMediaTypes) {
              const category = adverseMediaCategoryMap[adverseMediaType]
              mediaSources.push({
                category: category,
                createdAt: Date.now(),
                internalId: generateHashFromString(category, 16),
              })
            }
          }
          if (sanctionSearchType === 'SANCTIONS') {
            const newSanctionsSources = this.getSanctionsSources(
              entity.SanctionsReferences,
              masters.SanctionsReferencesList,
              ENTITY_SANCTIONS_DESCRIPTION2_VALUES
            )
            sanctionsSources.push(...newSanctionsSources)
          }
        }

        const sanctionsEntity: SanctionsEntity = {
          id: entity['@_id'],
          name: normalizedName,
          entityType,
          matchTypes: [
            ...(descriptions
              ?.map((d) => {
                return this.getDescriptionsSpecific(d, masters, [2])?.[0]
              })
              .filter(Boolean) ?? []),
          ],
          freetext: entity.ProfileNotes,
          documents,
          sanctionSearchTypes,
          types: descriptions?.map((d) =>
            this.getDescriptionsSpecific(d, masters, [1, 2, 3]).join(' - ')
          ),
          screeningSources: this.getSourceDescriptions(
            entity.SourceDescription
          ),
          aka,
          normalizedAka,
          countries,
          nationality: countryOfNationality,
          countryCodes,
          yearOfBirth: this.getYearFromDates(
            entity.DateDetails?.Date,
            'Date of Registration'
          ),
          isActiveSanctioned: this.isActiveSanctioned(
            entity.SanctionsReferences
          ),
          sanctionsSources,
          mediaSources,
          rawResponse: entity,
          aggregatedSourceIds: compact(
            uniq([
              ...sanctionsSources
                .filter((s) => s.sourceName && s.category)
                .map((s) => `${s.internalId}-${s.category}`),
              ...mediaSources.map((s) => s.category),
            ])
          ),
        }

        return [
          entity['@_action'] as Action,
          removeUndefinedFields(sanctionsEntity) as SanctionsEntity,
        ]
      })
    )
  }

  private async listFilePaths(dir: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dir)
      const filePaths: string[] = []

      for (const file of files) {
        const filePath = path.join(dir, file)
        const stats = await fs.promises.stat(filePath)

        if (stats.isFile() && !path.basename(filePath).startsWith('.')) {
          filePaths.push(filePath)
        }
      }

      return filePaths
    } catch (err) {
      logger.warn('Error reading directory:', err)
      return []
    }
  }

  private getNameValue(nameValue: any) {
    let name = ''
    const NAME_TYPES = ['FirstName', 'MiddleName', 'Surname']
    const SINGLE_STRING_NAME = 'SingleStringName'
    name = decode(
      Object.entries(nameValue).reduce((acc, [key, val]) => {
        if (val && typeof val === 'string' && NAME_TYPES.includes(key)) {
          return `${acc} ${val}`.trim()
        }
        return acc
      }, '')
    )
    if (!name && nameValue[SINGLE_STRING_NAME]) {
      name = nameValue[SINGLE_STRING_NAME]
    }
    return name
  }
  private getAdverseMedia(
    item: any,
    description1Id: string,
    adverseMediaIds: string[]
  ): DowJonesAdverseMediaSourceRelevance[] {
    const descriptions = this.getDescriptions(item)
    const description1Values = descriptions
      ?.map((d) => d['@_Description1'])
      .filter(Boolean)

    if (!description1Values?.includes(description1Id)) {
      return []
    }

    const description2Values = descriptions
      ?.map((d) => d['@_Description2'])
      .filter(Boolean)

    const matchingDescriptions: DowJonesAdverseMediaSourceRelevance[] = []
    for (const description2Value of description2Values || []) {
      if (adverseMediaIds.includes(description2Value)) {
        const description =
          ADVERSE_MEDIA_ID_TO_DESCRIPTION_MAP[description2Value]
        if (description) {
          matchingDescriptions.push(description)
        }
      }
    }

    return matchingDescriptions
  }

  private getAdverseMediaForPerson(
    person: any
  ): DowJonesAdverseMediaSourceRelevance[] {
    return this.getAdverseMedia(
      person,
      '3', // SIP
      PERSON_ADVERSE_MEDIA_DESCRIPTION2_IDS
    )
  }

  private getAdverseMediaForEntity(
    entity: any
  ): DowJonesAdverseMediaSourceRelevance[] {
    return this.getAdverseMedia(
      entity,
      '4', // SIE
      ENTITY_ADVERSE_MEDIA_DESCRIPTION2_IDS
    )
  }

  private getSanctionsSources(
    sanctionsReferences,
    sanctionsReferencesList,
    description2Ids
  ): SanctionsSource[] {
    if (!sanctionsReferences || !sanctionsReferencesList) {
      return []
    }

    return compact(
      sanctionsReferences.flatMap((sanctionRef) => {
        const references = Array.isArray(sanctionRef.Reference)
          ? sanctionRef.Reference
          : [sanctionRef.Reference]

        return references.map((ref) => {
          const referenceCode = ref['#text']
          const referenceInfo = sanctionsReferencesList[referenceCode]

          if (!referenceInfo) {
            return undefined
          }
          const description2Value = referenceInfo['@_Description2Id']
          if (!description2Ids.includes(description2Value)) {
            return undefined
          }
          const name = referenceInfo['@_name']
          const category =
            SANCTIONS_CATEGORY_MAP[referenceInfo['@_status'].toLowerCase()]
          const normalisedSourceName = name ? normalizeSource(name) : undefined
          let internalId: string | undefined
          if (normalisedSourceName) {
            const hash = generateHashFromString(normalisedSourceName, 16)
            this.sourceNameToHash.set(normalisedSourceName, hash)
            internalId = hash
          }
          if (name) {
            if (
              PERSON_SANCTIONS_DESCRIPTION2_VALUES.some((d) =>
                description2Ids.includes(d)
              )
            ) {
              const currentCount =
                this.sanctionsSourceToEntityCountPerson.get(name) || 0
              this.sanctionsSourceToEntityCountPerson.set(
                name,
                currentCount + 1
              )
            }
            if (
              ENTITY_SANCTIONS_DESCRIPTION2_VALUES.some((d) =>
                description2Ids.includes(d)
              )
            ) {
              const currentCount =
                this.sanctionsSourceToEntityCountBusiness.get(name) || 0
              this.sanctionsSourceToEntityCountBusiness.set(
                name,
                currentCount + 1
              )
            }
          }
          return {
            name,
            category,
            sourceName: normalisedSourceName,
            internalId: internalId,
            createdAt: Date.now(),
          }
        })
      })
    )
  }

  private getPepSources(occupations: SanctionsOccupation[]): SanctionsSource[] {
    if (!occupations || !Array.isArray(occupations)) {
      return []
    }

    return compact(
      occupations.map((occupation) => {
        if (!occupation.rank) {
          return undefined
        }

        const displayName = LEVEL_TIER_MAP[occupation.rank]
        const sourceName = normalizeSource(displayName)
        const internalId = generateHashFromString(sourceName, 16)

        // Store the mapping for future use
        this.sourceNameToHash.set(sourceName, internalId)

        // Update the count
        const currentCount =
          this.pepSourceToEntityCountPerson.get(displayName) || 0
        this.pepSourceToEntityCountPerson.set(displayName, currentCount + 1)

        return {
          category: 'PEP',
          createdAt: Date.now(),
          sourceName: sourceName,
          internalId: internalId,
        }
      })
    )
  }

  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const result = await super.search(request)
    return result
  }
}
