import compact from 'lodash/compact'
import concat from 'lodash/concat'
import startCase from 'lodash/startCase'
import uniq from 'lodash/uniq'
import { COUNTRIES } from '@flagright/lib/constants/countries'
import { AnyBulkWriteOperation, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  COLLECTIONS_MAP,
  getSanctionsSourceDocumentsCollectionName,
} from '../utils'
import { MongoSanctionSourcesRepository } from '../repositories/sanction-source-repository'
import { getNameAndAka } from './utils'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { traceable } from '@/core/xray'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { OpenSanctionsSearchType } from '@/@types/openapi-internal/OpenSanctionsSearchType'
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/OpenSanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'
import { tenantSettings } from '@/core/utils/context'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SourceDocument } from '@/@types/openapi-internal/SourceDocument'
import { getMongoDbClient } from '@/utils/mongodb-utils'
type OpenSanctionsLine = {
  op: string
  entity: OpenSanctionsPersonEntity
}

const openSanctionsBaseUrl = 'https://www.opensanctions.org/datasets/'

interface OpenSanctionsEntity {
  id: string
  caption?: string
  schema?: string
  referents?: string[]
  datasets?: string[]
  first_seen?: string
  last_seen?: string
  last_change?: string
  target?: boolean
}

type OpenSanctionsSanctionEntity = OpenSanctionsEntity & {
  properties: {
    entity: string[]
    program: string[]
    sourceUrl: string[]
    programUrl: string[]
    authority: string[]
    country: string[]
    programId: string[]
  }
}

type OpenSanctionsPersonEntity = OpenSanctionsEntity & {
  properties: {
    name?: string[]
    summary?: string[]
    description?: string[]
    previousName?: string[]
    weakAlias?: string[]
    publisher?: string[]
    keywords?: string[]
    title?: string[]
    firstName?: string[]
    secondName?: string[]
    middleName?: string[]
    lastName?: string[]
    nameSuffix?: string[]
    birthDate?: string[]
    birthCountry?: string[]
    deathDate?: string[]
    position?: string[]
    topics?: string[]
    gender?: string[]
    createdAt?: string[]
    country?: string[]
    citizenship?: string[]
    alias?: string[]
    birthPlace?: string[]
    sourceUrl?: string[]
    notes?: string[]
    fatherName?: string[]
    address?: string[]
    nationality?: string[]
    modifiedAt?: string[]
    passportNumber?: string[]
    socialSecurityNumber?: string[]
    political?: string[]
    idNumber?: string[]
    innCode?: string[]
    programId?: string[]
  }
}

type OpenSanctionsOrgProperties = {
  name?: string[]
  summary?: string[]
  description?: string[]
  country?: string[]
  alias?: string[]
  previousName?: string[]
  weakAlias?: string[]
  sourceUrl?: string[]
  publisher?: string[]
  keywords?: string[]
  title?: string[]
  topics?: string[]
  notes?: string[]
  createdAt?: string[]
  modifiedAt?: string[]
  email?: string[]
  phone?: string[]
  legalForm?: string[]
  incorporationDate?: string[]
  status?: string[]
  sector?: string[]
  classification?: string[]
  swiftBic?: string[]
  registrationNumber?: string[]
  idNumber?: string[]
  innCode?: string[]
  vatCode?: string[]
  jurisdiction?: string[]
  mainCountry?: string[]
  icijId?: string[]
  okpoCode?: string[]
  ogrnCode?: string[]
  leiCode?: string[]
  dunsCode?: string[]
  uniqueEntityId?: string[]
  npiCode?: string[]
  cageCode?: string[]
  permId?: string[]
  imoNumber?: string[]
  giiNumber?: string[]
  kppCode?: string[]
  bikCode?: string[]
  ricCode?: string[]
  programId?: string[]
}

type OpenSanctionsOrganizationEntity = OpenSanctionsEntity & {
  properties: OpenSanctionsOrgProperties
}

type Program = {
  sourceName: string
  displayName: string
  sourceCountry: string
}

const DATAFEED_URL =
  'https://data.opensanctions.org/datasets/latest/default/entities.ftm.json'
@traceable
export class OpenSanctionsProvider extends SanctionsDataFetcher {
  private types: OpenSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]
  private iteration: number = 0
  private programs: Record<string, Program> = {}

  private SanctionsSourceToEntityIdMapPerson = new Map<string, number>()
  private SanctionsSourceToEntityIdMapBusiness = new Map<string, number>()
  private PEPToEntityIdMapPerson = new Map<string, number>()
  private PEPToEntityIdMapBusiness = new Map<string, number>()
  private CrimeSourceToEntityIdMapPerson = new Map<string, number>()
  private CrimeSourceToEntityIdMapBusiness = new Map<string, number>()

  static async build(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient },
    settings?: SanctionsSettingsProviderScreeningTypes
  ) {
    let types: OpenSanctionsSearchType[] | undefined
    let entityTypes: SanctionsEntityType[] | undefined
    if (settings) {
      types = settings.screeningTypes as OpenSanctionsSearchType[]
      entityTypes = settings.entityTypes as SanctionsEntityType[]
    } else {
      const settings = await tenantSettings(tenantId)
      const openSanctionSettings =
        settings?.sanctions?.providerScreeningTypes?.find(
          (type) => type.provider === SanctionsDataProviders.OPEN_SANCTIONS
        )
      if (openSanctionSettings) {
        types = openSanctionSettings.screeningTypes as OpenSanctionsSearchType[]
        entityTypes = openSanctionSettings.entityTypes as SanctionsEntityType[]
      }
    }
    return new OpenSanctionsProvider(
      tenantId,
      types ?? OPEN_SANCTIONS_SEARCH_TYPES,
      entityTypes ?? COLLECTIONS_MAP[SanctionsDataProviders.OPEN_SANCTIONS],
      connections
    )
  }

  constructor(
    tenantId: string,
    types: OpenSanctionsSearchType[],
    entityTypes: SanctionsEntityType[],
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    super(SanctionsDataProviders.OPEN_SANCTIONS, tenantId, connections)
    this.types = types
    this.entityTypes = entityTypes
  }

  async fullLoad(
    repo: SanctionsRepository,
    version: string,
    entityType?: SanctionsEntityType
  ) {
    this.iteration = 0
    if (!entityType) {
      return
    }
    await this.loadPrograms()
    this.entityTypes = [entityType]
    await this.processUrl(repo, version, DATAFEED_URL)
    await this.processSanctionsSources(repo, version)
  }

  async processSanctionsSources(repo: SanctionsRepository, version: string) {
    let operations: AnyBulkWriteOperation<SanctionsEntity>[] = []
    await this.streamResponseLines(DATAFEED_URL, async (line) => {
      const entity: OpenSanctionsSanctionEntity | undefined = JSON.parse(line)
      if (!entity || entity.schema !== 'Sanction') {
        return
      }
      const sanctionsEntity = this.transformSanctionsEntity(entity)
      const sanctionsSource = sanctionsEntity?.sanctionsSources?.[0]
      if (sanctionsEntity && sanctionsSource) {
        operations.push({
          updateOne: {
            filter: {
              id: sanctionsEntity.id,
              provider: SanctionsDataProviders.OPEN_SANCTIONS,
            },
            update: {
              $addToSet: {
                sanctionsSources: sanctionsSource,
              },
            },
            upsert: false,
          },
        })
      }
      if (
        (this.iteration < 100 && operations.length > 100) ||
        operations.length > 1000
      ) {
        this.iteration++
        await Promise.all([
          repo.saveSanctionsData(operations),
          this.saveSourceMapsToCollection(version),
        ])
        logger.info(`Saved ${operations.length} entities`)
        operations = []
      }
    })
    if (operations.length > 0) {
      await Promise.all([
        repo.saveSanctionsData(operations),
        this.saveSourceMapsToCollection(version),
      ])
      logger.info(`Saved ${operations.length} entities`)
    }
  }

  private transformSanctionsEntity(
    entity: OpenSanctionsSanctionEntity
  ): Partial<SanctionsEntity> | undefined {
    const id = entity.properties.entity[0]
    if (!id) {
      return undefined
    }
    if (!entity.properties.programId?.length) {
      return undefined
    }
    const sanctionsSource = this.getSanctionsSources(
      entity.properties.programId,
      'PERSON'
    )[0]
    if (!sanctionsSource) {
      return undefined
    }
    return {
      id,
      sanctionsSources: [
        {
          ...sanctionsSource,
          ...(entity.properties.sourceUrl?.length
            ? { url: entity.properties.sourceUrl[0] }
            : {}),
        },
      ],
    }
  }

  async loadPrograms() {
    const res = await fetch('https://data.opensanctions.org/meta/programs.json')
    const data = (await res.json()).data
    for (const program of data) {
      const sourceName = program.issuer.name + ' - ' + program.title
      const sourceCountry = program.issuer.territory
        ? program.issuer.territory.toUpperCase()
        : null
      const sourceCountryName = sourceCountry
        ? COUNTRIES[sourceCountry]
          ? COUNTRIES[sourceCountry]
          : sourceCountry === 'EU'
          ? 'European Union'
          : 'international'
        : 'international'
      this.programs[program.key] = {
        sourceName: sourceName.toLowerCase(),
        displayName: sourceName,
        sourceCountry: sourceCountryName,
      }
    }
  }

  async delta(
    repo: SanctionsRepository,
    version: string,
    from: Date,
    entityType?: SanctionsEntityType
  ) {
    this.iteration = 0
    if (entityType) {
      this.entityTypes = [entityType]
    }
    await this.loadPrograms()
    const metadata = await fetch(
      'https://data.opensanctions.org/datasets/latest/default/index.json'
    )
    const json = await metadata.json()
    const deltaUrl = json['delta_url']
    const deltaMeta = await fetch(deltaUrl)
    const deltaMetaJson = await deltaMeta.json()
    const filteredUrls = this.filterUrls(deltaMetaJson, from)
    // TODO remove splice
    await Promise.all(
      filteredUrls.map((url) => this.processDeltaUrl(repo, version, url))
    )
  }

  public filterUrls(json: object, from: Date): string[] {
    const versions = Object.keys(json['versions'])
    const targetUrls: string[] = []
    versions.forEach((version) => {
      const timestampPart = version.split('-')[0] || ''
      // Convert the timestamp to a Date object
      const timestampDate = new Date(
        parseInt(timestampPart.slice(0, 4)), // Year
        parseInt(timestampPart.slice(4, 6)) - 1, // Month (0-based)
        parseInt(timestampPart.slice(6, 8)), // Day
        parseInt(timestampPart.slice(8, 10)), // Hours
        parseInt(timestampPart.slice(10, 12)), // Minutes
        parseInt(timestampPart.slice(12, 14)) // Seconds
      )

      if (timestampDate >= from) {
        targetUrls.push(json['versions'][version])
      }
    })
    return targetUrls
  }

  private async processDeltaUrl(
    repo: SanctionsRepository,
    version: string,
    url: string
  ) {
    let entities: [Action, SanctionsEntity][] = []
    await this.streamResponseLines(url, async (line) => {
      const parsedLine: OpenSanctionsLine = JSON.parse(line)

      // TODO Handle this
      if (parsedLine.op === 'DEL' || !parsedLine.entity.properties.name) {
        return
      }

      const entity = parsedLine.entity

      const sanctionsEntity = this.transformInput(entity)
      switch (parsedLine.op) {
        case 'ADD':
        case 'MOD':
          if (sanctionsEntity) {
            entities.push(['add', sanctionsEntity])
          }
          break
        default:
          throw new Error(`Unknown operation ${parsedLine.op}`)
      }
      if (
        (this.iteration < 100 && entities.length > 100) ||
        entities.length > 1000
      ) {
        this.iteration++
        await repo.save(
          SanctionsDataProviders.OPEN_SANCTIONS,
          entities,
          version
        )
        await this.saveSourceMapsToCollection(version)
        logger.info(`Saved ${entities.length} entities`)
        entities = []
      }
    })
    if (entities.length) {
      await repo.save(SanctionsDataProviders.OPEN_SANCTIONS, entities, version)
      await this.saveSourceMapsToCollection(version)
      logger.info(`Saved ${entities.length} entities`)
      entities = []
    }
  }
  private async processUrl(
    repo: SanctionsRepository,
    version: string,
    url: string
  ) {
    let entities: [Action, SanctionsEntity][] = []
    await this.streamResponseLines(url, async (line) => {
      const entity: OpenSanctionsPersonEntity | undefined = JSON.parse(line)
      if (!entity) {
        return
      }
      const sanctionsEntity = this.transformInput(entity)
      if (sanctionsEntity) {
        entities.push(['add', sanctionsEntity])
      }
      if (
        (this.iteration < 100 && entities.length > 100) ||
        entities.length > 1000
      ) {
        this.iteration++
        await repo.save(
          SanctionsDataProviders.OPEN_SANCTIONS,
          entities,
          version
        )
        await this.saveSourceMapsToCollection(version)
        logger.info(`Saved ${entities.length} entities`)
        entities = []
      }
    })
    if (entities.length) {
      await repo.save(SanctionsDataProviders.OPEN_SANCTIONS, entities, version)
      await this.saveSourceMapsToCollection(version)
      logger.info(`Saved ${entities.length} entities`)
      entities = []
    }
  }

  private async saveSourceMapsToCollection(version: string) {
    const sourceDocuments: [Action, SourceDocument][] = []
    // Process Sanctions Sources for Persons
    for (const [
      id,
      entityCount,
    ] of this.SanctionsSourceToEntityIdMapPerson.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityType: 'PERSON',
          sourceType: 'SANCTIONS',
          sourceCountry: this.programs[id].sourceCountry,
          entityCount,
          sourceName: this.programs[id].sourceName,
          displayName: this.programs[id].displayName,
        },
      ])
    }

    // Process Sanctions Sources for Businesses
    for (const [
      id,
      entityCount,
    ] of this.SanctionsSourceToEntityIdMapBusiness.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityCount,
          entityType: 'BUSINESS',
          sourceType: 'SANCTIONS',
          sourceCountry: this.programs[id].sourceCountry,
          sourceName: this.programs[id].sourceName,
          displayName: this.programs[id].displayName,
        },
      ])
    }

    // Process PEP Tiers for Persons
    for (const [id, count] of this.PEPToEntityIdMapPerson.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityCount: count,
          entityType: 'PERSON',
          sourceType: 'PEP',
          sourceName: id,
        },
      ])
    }

    for (const [id, count] of this.PEPToEntityIdMapBusiness.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityCount: count,
          entityType: 'BUSINESS',
          sourceType: 'PEP',
          sourceName: id,
        },
      ])
    }

    for (const [id, count] of this.CrimeSourceToEntityIdMapPerson.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityCount: count,
          entityType: 'PERSON',
          sourceType: 'CRIME',
          sourceName: id,
        },
      ])
    }

    for (const [id, count] of this.CrimeSourceToEntityIdMapBusiness.entries()) {
      sourceDocuments.push([
        'add',
        {
          id,
          entityCount: count,
          entityType: 'BUSINESS',
          sourceType: 'CRIME',
          sourceName: id,
        },
      ])
    }

    // save to collection acuris_source_documents
    const mongoDb = await getMongoDbClient()
    const repo = this.getSourceDocumentsRepo(mongoDb)
    await repo.save(
      SanctionsDataProviders.OPEN_SANCTIONS,
      sourceDocuments,
      version
    )
    this.SanctionsSourceToEntityIdMapPerson.clear()
    this.SanctionsSourceToEntityIdMapBusiness.clear()
    this.PEPToEntityIdMapPerson.clear()
    this.PEPToEntityIdMapBusiness.clear()
    this.CrimeSourceToEntityIdMapPerson.clear()
    this.CrimeSourceToEntityIdMapBusiness.clear()
  }

  private getSourceDocumentsRepo(mongoDb: MongoClient) {
    return new MongoSanctionSourcesRepository(
      mongoDb,
      getSanctionsSourceDocumentsCollectionName([
        SanctionsDataProviders.OPEN_SANCTIONS,
      ])
    )
  }

  private transformPersonEntity(
    entity: OpenSanctionsPersonEntity,
    sanctionSearchTypes: OpenSanctionsSearchType[]
  ): SanctionsEntity | undefined {
    const properties = entity.properties
    if (!this.entityTypes.includes('PERSON')) {
      return undefined
    }
    const name = entity.caption ?? 'Unknown'
    const {
      name: normalizedName,
      aka,
      normalizedAka,
    } = getNameAndAka(
      name.toLowerCase(),
      uniq(
        compact(
          concat(properties.alias || [], properties.name || [], name).map((n) =>
            n.toLowerCase()
          )
        )
      )
    )
    const pepSources = sanctionSearchTypes.includes('PEP')
      ? this.getPepSources(entity?.properties?.topics ?? [], 'PERSON')
      : []
    const crimeSources = sanctionSearchTypes.includes('CRIME')
      ? this.getCrimeSources(entity?.properties?.topics ?? [], 'PERSON')
      : []
    const sanctionsSources = this.getSanctionsSources(
      entity?.properties?.programId ?? [],
      'PERSON'
    )

    if (sanctionsSources.length > 0) {
      sanctionSearchTypes = uniq([...sanctionSearchTypes, 'SANCTIONS'])
    }
    return {
      id: entity.id,
      name: normalizedName,
      aka,
      normalizedAka,
      countryCodes: (properties.citizenship?.map((c) =>
        c.toUpperCase()
      ) as CountryCode[]) || ['ZZ'],
      types: concat(
        entity.datasets || [],
        entity.referents || [],
        sanctionSearchTypes
      ),
      entityType: 'PERSON',
      freetext: properties.notes?.join('\n') || '',
      gender: properties.gender?.[0]
        ? startCase(properties.gender[0])
        : 'Unknown',
      matchTypes: [],
      nationality: (properties.nationality?.map((c) =>
        c.toUpperCase()
      ) as CountryCode[]) || ['ZZ'],
      sanctionSearchTypes,
      screeningSources: concat(
        properties.sourceUrl?.map((source) => ({
          url: source,
          name: source,
        })) || [],
        (entity.datasets || []).map((dataset) => ({
          url: `${openSanctionsBaseUrl}${dataset}`,
          name: startCase(dataset.replace(/_/g, ' ')),
        }))
      ),
      yearOfBirth: properties.birthDate?.map((date) =>
        dayjs(date).format('YYYY')
      ),
      countries: compact(
        uniq(
          concat(
            properties.country || [],
            properties.birthCountry || [],
            properties.nationality || [],
            properties.citizenship || []
          )
        ).map((country) => COUNTRIES[country.toUpperCase() as CountryCode])
      ),
      dateOfBirths: properties.birthDate,
      updatedAt: Date.now(),
      isDeseased: properties.deathDate?.[0] ? true : false,
      occupations: compact(
        concat(
          properties.political?.map((o) => {
            return {
              title: `Political, ${o}`,
            }
          }),
          properties.position?.map((o) => {
            return {
              title: o,
            }
          })
        )
      ),
      documents: concat(
        compact(properties.innCode).map((o) => {
          return {
            id: o,
            formattedId: o.replace('-', ''),
            name: 'Russian company ID',
          }
        }),
        compact(
          properties.idNumber?.map((o) => {
            const text =
              properties.passportNumber?.find(
                (p) => p.includes(o) && p.includes(',')
              ) ?? ''
            const name =
              text.indexOf(o) !== -1
                ? text
                    ?.substring(0, text.indexOf(o) - 2)
                    ?.split(',')
                    ?.pop()
                    ?.trim()
                : 'Id Number'
            return {
              id: o,
              formattedId: o.replace('-', ''),
              name: name ?? 'Id Number',
            }
          })
        )
      ),
      isActivePep: undefined,
      pepSources,
      otherSources: [
        ...(crimeSources.length
          ? [
              {
                type: 'CRIME',
                value: crimeSources,
              },
            ]
          : []),
      ],
      sanctionsSources,
      isActiveSanctioned: undefined,
      aggregatedSourceIds: compact([
        ...crimeSources.map((source) => source.internalId),
        ...pepSources.map((source) => source.internalId),
        ...sanctionsSources.map((source) => source.internalId),
      ]),
    }
  }

  private getPepSources(topics: string[], entityType: SanctionsEntityType) {
    const pepSources = topics
      .filter((topic) => topic.startsWith('role') || topic.startsWith('poi'))
      .map((topic) => ({
        sourceName: topic,
        internalId: topic,
      }))
    for (const source of pepSources) {
      if (entityType === 'PERSON') {
        const state = this.PEPToEntityIdMapPerson.get(source.internalId) || 0
        this.PEPToEntityIdMapPerson.set(source.internalId, state + 1)
      } else if (entityType === 'BUSINESS') {
        const state = this.PEPToEntityIdMapBusiness.get(source.internalId) || 0
        this.PEPToEntityIdMapBusiness.set(source.internalId, state + 1)
      }
    }
    return pepSources
  }
  private getCrimeSources(topics: string[], entityType: SanctionsEntityType) {
    const crimeSources = topics
      .filter((topic) => topic.startsWith('crime'))
      .map((topic) => ({
        sourceName: topic,
        internalId: topic,
      }))
    for (const source of crimeSources) {
      if (entityType === 'PERSON') {
        const state =
          this.CrimeSourceToEntityIdMapPerson.get(source.internalId) || 0
        this.CrimeSourceToEntityIdMapPerson.set(source.internalId, state + 1)
      } else if (entityType === 'BUSINESS') {
        const state =
          this.CrimeSourceToEntityIdMapBusiness.get(source.internalId) || 0
        this.CrimeSourceToEntityIdMapBusiness.set(source.internalId, state + 1)
      }
    }
    return crimeSources
  }
  private getSanctionsSources(
    programId: string[],
    entityType: SanctionsEntityType
  ): SanctionsSource[] {
    const sanctionsSources = programId.map((id) => ({
      sourceName: this.programs[id].sourceName,
      internalId: id,
    }))
    for (const source of sanctionsSources) {
      if (entityType === 'PERSON') {
        const state =
          this.SanctionsSourceToEntityIdMapPerson.get(source.internalId) || 0
        this.SanctionsSourceToEntityIdMapPerson.set(
          source.internalId,
          state + 1
        )
      } else if (entityType === 'BUSINESS') {
        const state =
          this.SanctionsSourceToEntityIdMapBusiness.get(source.internalId) || 0
        this.SanctionsSourceToEntityIdMapBusiness.set(
          source.internalId,
          state + 1
        )
      }
    }
    return sanctionsSources
  }

  private transformOrganizationEntity(
    entity: OpenSanctionsOrganizationEntity,
    sanctionSearchTypes: OpenSanctionsSearchType[]
  ): SanctionsEntity | undefined {
    const properties = entity.properties
    const schema =
      entity.properties?.topics?.find((topic) => topic === 'fin.bank') ||
      entity.properties.swiftBic?.length
        ? 'BANK'
        : 'BUSINESS'
    if (!this.entityTypes.includes(schema)) {
      return undefined
    }
    const countryOfIncorporation = uniq(
      concat(
        properties.country || [],
        properties.mainCountry || [],
        properties.jurisdiction || []
      )
    ).map((country) => country.toUpperCase() as CountryCode)
    const name = entity.caption ?? 'Unknown'
    const {
      name: normalizedName,
      aka,
      normalizedAka,
    } = getNameAndAka(
      name.toLowerCase(),
      uniq(
        compact(
          concat(properties.alias || [], properties.name || [], name).map((n) =>
            n.toLowerCase()
          )
        )
      )
    )
    const pepSources = sanctionSearchTypes.includes('PEP')
      ? this.getPepSources(entity?.properties?.topics ?? [], 'BUSINESS')
      : []
    const crimeSources = sanctionSearchTypes.includes('CRIME')
      ? this.getCrimeSources(entity?.properties?.topics ?? [], 'BUSINESS')
      : []
    const sanctionsSources = this.getSanctionsSources(
      entity?.properties?.programId ?? [],
      'BUSINESS'
    )
    if (sanctionsSources.length > 0) {
      sanctionSearchTypes = uniq([...sanctionSearchTypes, 'SANCTIONS'])
    }
    return {
      id: entity.id,
      name: normalizedName,
      entityType: schema,
      aka,
      normalizedAka,
      sanctionSearchTypes,
      types: concat(
        entity.datasets || [],
        entity.referents || [],
        sanctionSearchTypes
      ),
      freetext: properties.notes?.join('\n') || '',
      screeningSources: properties.sourceUrl?.map((source) => ({
        url: source,
        name: source,
      })),
      yearOfBirth: properties.incorporationDate?.map((date) =>
        dayjs(date).format('YYYY')
      ),
      dateOfBirths: properties.incorporationDate,
      documents: [
        ...this.getDocuments(properties.swiftBic, 'SWIFT BIC'),
        ...this.getDocuments(
          properties.registrationNumber,
          'Registration Number'
        ),
        ...this.getDocuments(properties.okpoCode, 'OKPO Code'),
        ...this.getDocuments(properties.cageCode, 'CAGE Code'),
        ...this.getDocuments(properties.permId, 'Perm ID'),
        ...this.getDocuments(properties.imoNumber, 'IMO Number'),
        ...this.getDocuments(properties.giiNumber, 'GII Number'),
        ...this.getDocuments(properties.kppCode, 'KPP Code'),
        ...this.getDocuments(properties.bikCode, 'BIC Code'),
        ...this.getDocuments(properties.ricCode, 'RIC Code'),
        ...this.getDocuments(properties.uniqueEntityId, 'Unique Entity ID'),
        ...this.getDocuments(properties.npiCode, 'NPI Code'),
        ...this.getDocuments(properties.vatCode, 'VAT Code'),
        ...this.getDocuments(properties.icijId, 'ICIJ ID'),
        ...this.getDocuments(properties.ogrnCode, 'OGRN Code'),
        ...this.getDocuments(properties.okpoCode, 'OKPO Code'),
        ...this.getDocuments(properties.innCode, 'INN Code'),
        ...this.getDocuments(properties.idNumber, 'ID Number'),
      ],
      countries: compact(
        countryOfIncorporation.map(
          (country) => COUNTRIES[country as CountryCode]
        )
      ),
      nationality: (countryOfIncorporation.length
        ? countryOfIncorporation
        : ['ZZ']) as CountryCode[],
      pepSources,
      otherSources: [
        ...(crimeSources.length
          ? [
              {
                type: 'CRIME',
                value: crimeSources,
              },
            ]
          : []),
      ],
      sanctionsSources,
      isActiveSanctioned: undefined,
      aggregatedSourceIds: compact([
        ...crimeSources.map((source) => source.internalId),
        ...pepSources.map((source) => source.internalId),
        ...sanctionsSources.map((source) => source.internalId),
      ]),
    }
  }

  transformInput(
    entity: OpenSanctionsPersonEntity
  ): SanctionsEntity | undefined {
    const properties = entity.properties
    const sanctionSearchTypes = uniq(
      compact(
        properties.topics?.map((topic) => {
          switch (topic) {
            case 'crime':
            case 'crime.fraud':
            case 'crime.cyber':
            case 'crime.fin':
            case 'crime.env':
            case 'crime.theft':
            case 'crime.war':
            case 'crime.boss':
            case 'crime.terror':
            case 'crime.traffick':
            case 'crime.traffick.drug':
            case 'crime.traffick.human':
              return 'CRIME'
            case 'role.pep':
            case 'role.rca':
            case 'role.oligarch':
            case 'role.judge':
            case 'role.diplo':
              return 'PEP'
            case 'sanction':
            case 'sanction.linked':
            case 'sanction.counter':
              return 'SANCTIONS'
            case 'poi':
              return 'PEP'
          }
        })
      )
    )
    if (sanctionSearchTypes.length === 0) {
      return undefined
    }
    if (entity.schema === 'Person') {
      return this.transformPersonEntity(entity, sanctionSearchTypes)
    } else if (
      entity.schema === 'Organization' ||
      entity.schema === 'Company' ||
      entity.schema === 'LegalEntity'
    ) {
      return this.transformOrganizationEntity(
        entity as OpenSanctionsOrganizationEntity,
        sanctionSearchTypes
      )
    }
    return undefined
  }

  private async streamResponseLines(
    url: string,
    processLine: (line: string) => Promise<void>
  ): Promise<void> {
    const response = await fetch(url)
    if (!response.body) {
      throw new Error('Stream not supported')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      // Decode the chunk and append it to the buffer
      buffer += decoder.decode(value, { stream: true })

      // Split the buffer by lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep the last (incomplete) line in the buffer

      // Process each complete line
      for (const line of lines) {
        await processLine(line)
        // Perform further processing of the line here
      }
    }

    // Handle the final line in the buffer, if it exists
    if (buffer) {
      await processLine(buffer)
    }
  }
  private getDocuments(ids: string[] | undefined, name: string) {
    return compact(ids).map((o) => {
      return {
        id: o,
        formattedId: o.replace('-', ''),
        name: name,
      }
    })
  }
}
