import { Readable, pipeline, Transform } from 'stream'
import { createInterface } from 'readline'
import { promisify } from 'util'
import { capitalize, compact, concat, uniq } from 'lodash'
import { COUNTRIES } from '@flagright/lib/constants'
import { MongoClient } from 'mongodb'
import {
  COLLECTIONS_MAP,
  extractCountryFromSource,
  getSanctionsCollectionName,
} from '../utils'
import { MongoSanctionsRepository } from '../repositories/sanctions-repository'
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
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'
import { getSecretByName } from '@/utils/secrets-manager'
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/AcurisSanctionsSearchType'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'
import { SanctionsEntityAddress } from '@/@types/openapi-internal/SanctionsEntityAddress'
import { SANCTIONS_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/SanctionsSourceRelevance'
import { REL_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/RELSourceRelevance'
import { SourceDocument } from '@/@types/openapi-internal/SourceDocument'
import { SANCTIONS_SOURCE_DOCUMENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { tenantSettings } from '@/core/utils/context'

const pipelineAsync = promisify(pipeline)

const EXTERNAL_TO_INTERNAL_TYPES: Record<string, AcurisSanctionsSearchType> = {
  'PEP-CURRENT': 'PEP',
  'PEP-FORMER': 'PEP',
  'PEP-LINKED': 'PEP',
  'SAN-CURRENT': 'SANCTIONS',
  'SAN-FORMER': 'SANCTIONS',
  'SOE-FORMER': 'PEP',
  'SOE-CURRENT': 'PEP',
  RRE: 'ADVERSE_MEDIA',
  POI: 'PEP',
  REL: 'REGULATORY_ENFORCEMENT_LIST',
}

const ACURIS_TYPES = {
  'PEP-CURRENT': 'Current PEP',
  'PEP-FORMER': 'Former PEP',
  'PEP-LINKED': 'Linked to PEP (PEP by Association)',
  'SAN-CURRENT': 'Current Sanctions',
  'SAN-FORMER': 'Former Sanctions',
  RRE: 'Reputational Risk Exposure',
  POI: 'Profile Of Interest',
  REL: 'Regulatory Enforcement List',
}

const PEP_TIERS = {
  'PEP Tier 1': 'LEVEL_1',
  'PEP Tier 2': 'LEVEL_2',
  'PEP Tier 3': 'LEVEL_3',
}

enum AcurisEntityType {
  individuals = 'PERSON',
  businesses = 'BUSINESS',
}

interface Address {
  addressType: string
  line1: string
  line2?: string
  postcode: string
  city: string
  county: string
  countyAbbrev?: string
  countryIsoCode: string
}

type SanctionEntry = {
  sanctionId: string
  measures: string[]
  regime: {
    body: string
    bodyId: string
    name: string
    origin: string
    types: string[]
  }
  events: {
    type: string
    dateIso: string
    evidenceIds: string[]
  }[]
}

type PepEntry = {
  countryIsoCode: string
  segment: string
  position: string
  dateFromIso: string
  dateToIso: string
  evidenceIds: string[]
}

type AcurisEvidence = {
  datasets: string[]
  evidenceId: string
  originalUrl: string
  isCopyrighted: boolean
  title: string
  credibility: string
  language: string
  summary: string
  keywords: string
  captureDateIso: string
  publicationDateIso: string
  assetUrl: string
}

interface AcurisEntity {
  entityType: string
  qrCode: string
  version: string
  resourceUri: string
  resourceId: string
  isDeleted: boolean
  deletionReason: {
    reason: string
    otherReason: string
  }
  addresses: Address[]
  profileImages: string[]
  notes: {
    value: string
  }[]
  contactEntries: string[]
  datasets: string[]
  identifiers: {
    category: string
    value: string
  }[]
  evidences: AcurisEvidence[]
  sanEntries: {
    current: SanctionEntry[]
    former: SanctionEntry[]
  }
  relEntries: {
    category: string
    subcategory: string
    events: {
      type: string
      currencyCode: string
      amount: number
      dateIso: string
      evidenceIds: string[]
      period: {
        days: number
        years: number
        months: number
      }
    }[]
  }[]
  rreEntries: {
    category: string
    subcategory: string
    events: {
      type: string
      dateIso: string
      evidenceIds: string[]
    }[]
  }[]
  poiEntries: {
    category: string
    evidenceIds: string[]
    positions: {
      position: string
      segment: string
      countryIsoCode: string
      dateFromIso: string
      dateToIso: string
    }[]
  }[]
  insEntries: {
    type: string
    insolvencyIdNumber: string
    solicitor: string
    court: string
    petitioner: string
    evidenceIds: string[]
    debt: string
    accountantInBankruptcyCaseNumber: string
    insolvencyStartDateIso: string
    insolvencyEndDateIso: string
    hearingDateIso: string
    presentedDateOfPetitionIso: string
    gazetteIssueDateIso: string
    awardDateIso: string
    firstOrderDateIso: string
  }[]
  individualLinks: {
    qrCode: string
    firstName: string
    middleName: string
    lastName: string
    relationship: string
    ownershipPercentage: number
    resourceUri: string
    resourceId: string
    datasets: string[]
  }[]
  businessLinks: {
    qrCode: string
    name: string
    resourceUri: string
    resourceId: string
    datasets: string[]
    relationship: string
    ownershipPercentage: number
  }[]
  griEntries: {
    evidenceId: string
    title: string
    summary: string
    keywords: string
  }[]
}

interface AcurisIndividualEntity extends AcurisEntity {
  firstName: string
  middleName: string
  lastName: string
  gender: string
  isDeseased: boolean
  datesOfBirthIso: string[]
  datesOfDeathIso: string[]
  nationalitiesIsoCodes: string[]
  activities: string[]
  ddEntries: {
    caseReference: string
    reason: string
    conduct: string
    dateFromIso: string
    dateToIso: string
    evidenceIds: string[]
  }[]
  pepEntries: {
    pepTier: string
    current: PepEntry[]
    former: PepEntry[]
  }
  pepByAssociationEntries: {
    qrCode: string
    resourceUri: string
    resourceId: string
    evidenceIds: string[]
  }[]
  aliases: {
    firstName: string
    middleName: string
    lastName: string
    type: string
  }[]
}

interface AcurisBusinessEntity extends AcurisEntity {
  name: string
  businessTypes: string[]
  aliases: {
    alias: string
    type: string
  }[]
  datesOfBirthIso: string[]
}

function normalizeSource(source?: string) {
  if (!source) {
    return ''
  }
  return source.toLowerCase().trim().replace(/\s+/g, ' ')
}

@traceable
export class AcurisProvider extends SanctionsDataFetcher {
  private apiKey: string
  private uri: string = 'https://api.acuris.com/compliance-datafeed'
  private screeningTypes: AcurisSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]

  private SanctionsSourceToEntityIdMapPerson = new Map<string, string[]>()
  private SanctionsSourceToEntityIdMapBusiness = new Map<string, string[]>()
  private PEPTierToEntityIdMapPerson = new Map<string, string[]>()
  private RELSourceToEntityIdMapPerson = new Map<string, string[]>()
  private RELSourceToEntityIdMapBusiness = new Map<string, string[]>()

  static async build(
    tenantId: string,
    settings?: SanctionsSettingsProviderScreeningTypes
  ) {
    let types: AcurisSanctionsSearchType[] | undefined
    let entityTypes: SanctionsEntityType[] | undefined
    if (settings) {
      types = settings.screeningTypes as AcurisSanctionsSearchType[]
      entityTypes = settings.entityTypes as SanctionsEntityType[]
    } else {
      const settings = await tenantSettings(tenantId)
      const acurisSettings = settings?.sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === SanctionsDataProviders.ACURIS
      )
      if (acurisSettings) {
        types = acurisSettings?.screeningTypes as AcurisSanctionsSearchType[]
        entityTypes = acurisSettings?.entityTypes as SanctionsEntityType[]
      }
    }
    const apiKey = (await getSecretByName(SanctionsDataProviders.ACURIS))
      ?.apiKey
    if (!apiKey) {
      throw new Error('Acuris API key not found')
    }
    return new AcurisProvider(
      tenantId,
      apiKey,
      types ?? ACURIS_SANCTIONS_SEARCH_TYPES,
      entityTypes ?? COLLECTIONS_MAP[SanctionsDataProviders.ACURIS]
    )
  }

  constructor(
    tenantId: string,
    apiKey: string,
    screeningTypes: AcurisSanctionsSearchType[],
    entityTypes: SanctionsEntityType[]
  ) {
    super(SanctionsDataProviders.ACURIS, tenantId)
    this.apiKey = apiKey
    this.screeningTypes = screeningTypes
    this.entityTypes = entityTypes
  }

  private async saveSourceMapsToCollection(version: string) {
    const sourceDocuments: [Action, SourceDocument][] = []
    // Process Sanctions Sources for Persons
    for (const [
      displayName,
      entityIds,
    ] of this.SanctionsSourceToEntityIdMapPerson.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds,
          entityType: 'PERSON',
          sourceType: 'SANCTIONS',
          sourceCountry: extractCountryFromSource(sourceName, 'SANCTIONS'),
          displayName: displayName,
        },
      ])
    }

    // Process Sanctions Sources for Businesses
    for (const [
      displayName,
      entityIds,
    ] of this.SanctionsSourceToEntityIdMapBusiness.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds,
          entityType: 'BUSINESS',
          sourceType: 'SANCTIONS',
          sourceCountry: extractCountryFromSource(sourceName, 'SANCTIONS'),
          displayName: displayName,
        },
      ])
    }

    // Process PEP Tiers for Persons
    for (const [
      displayName,
      entityIds,
    ] of this.PEPTierToEntityIdMapPerson.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds,
          entityType: 'PERSON',
          sourceType: 'PEP',
          displayName: displayName,
        },
      ])
    }

    // Process REL Sources for Persons
    for (const [
      displayName,
      entityIds,
    ] of this.RELSourceToEntityIdMapPerson.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds,
          entityType: 'PERSON',
          sourceType: 'REGULATORY_ENFORCEMENT_LIST',
          sourceCountry: extractCountryFromSource(
            sourceName,
            'REGULATORY_ENFORCEMENT_LIST'
          ),
          displayName: displayName,
        },
      ])
    }

    // Process REL Sources for Businesses
    for (const [
      displayName,
      entityIds,
    ] of this.RELSourceToEntityIdMapBusiness.entries()) {
      const sourceName = normalizeSource(displayName)
      sourceDocuments.push([
        'add',
        {
          sourceName,
          entityIds,
          entityType: 'BUSINESS',
          sourceType: 'REGULATORY_ENFORCEMENT_LIST',
          sourceCountry: extractCountryFromSource(
            sourceName,
            'REGULATORY_ENFORCEMENT_LIST'
          ),
          displayName: displayName,
        },
      ])
    }

    // save to collection acuris_source_documents
    const mongoDb = await getMongoDbClient()
    const repo = this.getSourceDocumentsRepo(mongoDb)
    await repo.save(SanctionsDataProviders.ACURIS, sourceDocuments, version)
    this.SanctionsSourceToEntityIdMapPerson.clear()
    this.SanctionsSourceToEntityIdMapBusiness.clear()
    this.PEPTierToEntityIdMapPerson.clear()
    this.RELSourceToEntityIdMapPerson.clear()
    this.RELSourceToEntityIdMapBusiness.clear()
  }

  async fullLoad(
    repo: SanctionsRepository,
    version: string,
    entityType?: SanctionsEntityType
  ) {
    if (!entityType) {
      return
    }

    const types = this.getEntityTypesToLoad(entityType)
    for (const type of types) {
      try {
        const response = await fetch(`${this.uri}/${type}/full-extract`, {
          headers: {
            'x-api-key': this.apiKey,
            'content-type': 'application/json',
          },
        })

        const data = (await response.json()) as {
          file: string
          timestamp: number
        }
        const file = await fetch(data.file)

        if (!file.body) {
          logger.error('No body')
          return
        }

        const bodyStream = Readable.from(
          file.body as unknown as NodeJS.ReadableStream
        )
        const rl = createInterface({ input: bodyStream, crlfDelay: Infinity })

        let lc = 0
        let entities: [Action, SanctionsEntity][] = []

        // Transform stream to process each line
        const processStream = new Transform({
          objectMode: true,
          transform: (line, _, callback) => {
            try {
              const entity = JSON.parse(line)
              let processedEntity: SanctionsEntity | undefined

              if (type === 'individuals') {
                processedEntity = this.processIndividualEntity(entity, 'PERSON')
              } else if (type === 'businesses') {
                processedEntity = this.processBusinessEntity(entity, 'BUSINESS')
              }

              if (processedEntity) {
                entities.push([
                  entity.isDeleted ? 'del' : 'add',
                  processedEntity,
                ])
                lc++

                if (entities.length > 1000) {
                  repo
                    .save(SanctionsDataProviders.ACURIS, entities, version)
                    .then(async () => {
                      logger.info(`Processed ${lc} entities`)
                      await this.saveSourceMapsToCollection(version)
                      entities = []
                      callback()
                    })
                    .catch(callback)
                  return
                }
              }
              callback()
            } catch (error) {
              callback(error as Error)
            }
          },
          flush: (callback) => {
            if (entities.length > 0) {
              repo
                .save(SanctionsDataProviders.ACURIS, entities, version)
                .then(() => callback())
                .catch(callback)
            } else {
              callback()
            }
          },
        })

        await pipelineAsync(rl, processStream)
        logger.info(`Finished processing ${type}`)
      } catch (error) {
        logger.info('Stream processing error:', error)
      }
    }
    await this.saveSourceMapsToCollection(version)
  }

  private getEntityTypesToLoad(entityType?: SanctionsEntityType) {
    return entityType
      ? [
          ...(entityType === AcurisEntityType.individuals
            ? ['individuals']
            : []),
          ...(entityType === AcurisEntityType.businesses ? ['businesses'] : []),
        ]
      : [
          ...(this.entityTypes.includes(AcurisEntityType.individuals)
            ? ['individuals']
            : []),
          ...(this.entityTypes.includes(AcurisEntityType.businesses)
            ? ['businesses']
            : []),
        ]
  }

  private getSourceDocumentsRepo(mongoDb: MongoClient) {
    return new MongoSanctionSourcesRepository(
      SANCTIONS_SOURCE_DOCUMENTS_COLLECTION(),
      mongoDb
    )
  }

  private getFullExtractRepo(entityType: SanctionsEntityType) {
    return new MongoSanctionsRepository(
      getSanctionsCollectionName(
        {
          provider: SanctionsDataProviders.ACURIS,
          entityType,
        },
        '', // Tenant independent
        'full'
      )
    )
  }

  private getRepo(
    personsRepo: MongoSanctionsRepository,
    businessesRepo: MongoSanctionsRepository,
    entityType: SanctionsEntityType
  ) {
    if (entityType === 'PERSON') {
      return personsRepo
    }
    return businessesRepo
  }

  async delta(
    repo: SanctionsRepository,
    version: string,
    from: Date,
    entityType?: SanctionsEntityType,
    runFullLoad?: boolean
  ) {
    const types = this.getEntityTypesToLoad(entityType)
    const fullExtractPersonRepo = this.getFullExtractRepo('PERSON')
    const fullExtractBusinessRepo = this.getFullExtractRepo('BUSINESS')
    for (const type of types) {
      let timestamp = runFullLoad
        ? dayjs().startOf('month').valueOf()
        : from.getTime()
      let entities: [Action, SanctionsEntity][] = []
      let hasMore = true
      while (hasMore) {
        const response = await fetch(
          `${this.uri}/${type}/delta?timestamp=${timestamp}`,
          {
            headers: {
              'x-api-key': this.apiKey,
              'content-type': 'application/json',
            },
          }
        )
        const data = await response.json()
        for (const entity of data.profiles) {
          if (type === 'individuals') {
            const e = this.processIndividualEntity(entity, 'PERSON')
            if (e) {
              entities.push([entity.isDeleted ? 'del' : 'add', e])
            }
          } else if (type === 'businesses') {
            const e = this.processBusinessEntity(entity, 'BUSINESS')
            if (e) {
              entities.push([entity.isDeleted ? 'del' : 'add', e])
            }
          }
          if (entities.length > 1000) {
            await Promise.all([
              repo.save(SanctionsDataProviders.ACURIS, entities, version),
              ...(!runFullLoad
                ? [
                    this.getRepo(
                      fullExtractPersonRepo,
                      fullExtractBusinessRepo,
                      AcurisEntityType[type]
                    ).save(
                      SanctionsDataProviders.ACURIS,
                      entities.filter(
                        ([_, e]) => e.entityType === AcurisEntityType[type]
                      ),
                      version
                    ),
                  ]
                : []),
            ])
            await this.saveSourceMapsToCollection(version)
            logger.info(`Processed ${entities.length} entities`)
            entities = []
          }
        }
        if (entities.length) {
          logger.info(`Processed ${entities.length} entities`)
          await Promise.all([
            repo.save(SanctionsDataProviders.ACURIS, entities, version),
            ...(!runFullLoad
              ? [
                  this.getRepo(
                    fullExtractPersonRepo,
                    fullExtractBusinessRepo,
                    AcurisEntityType[type]
                  ).save(
                    SanctionsDataProviders.ACURIS,
                    entities.filter(
                      ([_, e]) => e.entityType === AcurisEntityType[type]
                    ),
                    version
                  ),
                ]
              : []),
          ])
          await this.saveSourceMapsToCollection(version)
          entities = []
        }
        hasMore = Boolean(data.profiles?.length)
        timestamp = data.timestamp
      }
    }
  }

  private getOccupations(occupations: PepEntry[], pepTier: string) {
    return occupations?.map((entry) => ({
      title: entry.position,
      rank: PEP_TIERS[pepTier],
      country: entry.countryIsoCode as CountryCode,
      dateFrom: entry.dateFromIso,
      dateTo: entry.dateToIso,
    }))
  }

  private processIndividualEntity(
    entity: AcurisIndividualEntity,
    entityType: SanctionsEntityType
  ): SanctionsEntity | undefined {
    const pepTier = entity.pepEntries.pepTier
    const sanctionSearchTypes = uniq(
      entity.datasets.map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
    )
    const name = this.getEntityName(entity, entityType)
    const {
      name: normalizedName,
      aka,
      normalizedAka,
    } = getNameAndAka(
      name.toLowerCase(),
      entity.aliases.map((alias) =>
        this.getEntityName(alias, entityType).toLowerCase()
      )
    )
    const yearOfBirth = uniq(
      entity.datesOfBirthIso?.map((date) => dayjs(date).format('YYYY'))
    )
    return {
      id: entity.qrCode,
      name: normalizedName,
      entityType: entityType,
      types: compact(
        concat(
          entity.datasets.map((dataset) => ACURIS_TYPES[dataset]),
          sanctionSearchTypes
        )
      ),
      sanctionSearchTypes,
      gender: entity.gender,
      normalizedAka,
      aka,
      countries: compact(
        entity.nationalitiesIsoCodes.map(
          (code) => COUNTRIES[code as CountryCode]
        )
      ),
      nationality: entity.nationalitiesIsoCodes as CountryCode[],
      occupations: [
        ...this.getOccupations(entity.pepEntries.current ?? [], pepTier),
        ...this.getOccupations(entity.pepEntries.former ?? [], pepTier),
      ],
      yearOfBirth: yearOfBirth.length ? yearOfBirth : undefined,
      dateOfBirths: entity.datesOfBirthIso,
      isDeseased: entity.isDeseased,
      isActiveSanctioned: sanctionSearchTypes.includes('SANCTIONS')
        ? Boolean(entity.sanEntries.current.length)
        : undefined,
      isActivePep:
        sanctionSearchTypes.includes('PEP') &&
        entity.datasets.some((d) => d.startsWith('PEP'))
          ? Boolean(entity.pepEntries.current.length)
          : undefined,
      sanctionsSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'SANCTIONS'
            ) && sanctionSearchTypes.includes('SANCTIONS')
        )
        .map((evidence) => {
          const matchingSanEntry =
            entity.sanEntries.current.find((sanEntry) =>
              sanEntry.events.some((event) =>
                event.evidenceIds.includes(evidence.evidenceId)
              )
            ) ??
            entity.sanEntries.former.find((sanEntry) =>
              sanEntry.events.some((event) =>
                event.evidenceIds.includes(evidence.evidenceId)
              )
            )
          const evidenceName = matchingSanEntry?.regime.name
          const description = matchingSanEntry?.regime.body
          const normalisedSourceName = normalizeSource(evidenceName ?? 'Other')
          const displayName = evidenceName ?? 'Other'
          if (displayName) {
            const existingIds =
              this.SanctionsSourceToEntityIdMapPerson.get(displayName) || []
            this.SanctionsSourceToEntityIdMapPerson.set(displayName, [
              ...existingIds,
              entity.qrCode,
            ])
          }
          const category = matchingSanEntry
            ? entity.sanEntries.current.some((sanEntry) =>
                sanEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )
              ? SANCTIONS_SOURCE_RELEVANCES[0]
              : SANCTIONS_SOURCE_RELEVANCES[1]
            : undefined
          return this.getOtherSources(
            evidence,
            evidenceName,
            description,
            category,
            normalisedSourceName
          )
        }),
      pepSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'PEP'
            ) && sanctionSearchTypes.includes('PEP')
        )
        .map((evidence) => {
          const pepTier = entity.pepEntries.pepTier
          const evidenceName =
            entity.pepEntries.current.find((pepEntry) =>
              pepEntry.evidenceIds.includes(evidence.evidenceId)
            )?.segment ??
            entity.pepEntries.former.find((pepEntry) =>
              pepEntry.evidenceIds.includes(evidence.evidenceId)
            )?.segment
          const normalisedPepTier = normalizeSource(pepTier)
          const displayName = pepTier
          if (displayName) {
            const existingIds =
              this.PEPTierToEntityIdMapPerson.get(displayName) || []
            this.PEPTierToEntityIdMapPerson.set(displayName, [
              ...existingIds,
              entity.qrCode,
            ])
          }
          const category = entity.datasets.some((dataset) => dataset === 'POI')
            ? 'POI'
            : 'PEP'
          return this.getOtherSources(
            evidence,
            evidenceName,
            undefined,
            category,
            normalisedPepTier
          )
        }),
      associates: this.getAssociates(entity),
      mediaSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) =>
                EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'ADVERSE_MEDIA'
            ) && sanctionSearchTypes.includes('ADVERSE_MEDIA')
        )
        .map((evidence) => {
          const category = entity.rreEntries
            .find((rreEntry) =>
              rreEntry.events.some((event) =>
                event.evidenceIds.includes(evidence.evidenceId)
              )
            )
            ?.category.toLowerCase()
          return this.getMedia(evidence, category)
        }),
      rawResponse: entity,
      otherSources: [
        {
          type: 'REGULATORY_ENFORCEMENT_LIST',
          value: entity.evidences
            .filter(
              ({ datasets }) =>
                datasets.some(
                  (dataset) =>
                    EXTERNAL_TO_INTERNAL_TYPES[dataset] ===
                    'REGULATORY_ENFORCEMENT_LIST'
                ) && sanctionSearchTypes.includes('REGULATORY_ENFORCEMENT_LIST')
            )
            .map((evidence) => {
              const evidenceName = entity.relEntries.find((relEntry) =>
                relEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )?.subcategory
              const normalisedEvidenceName = normalizeSource(evidenceName ?? '')
              const displayName = evidenceName ?? ''
              if (displayName) {
                const existingIds =
                  this.RELSourceToEntityIdMapPerson.get(displayName) || []
                this.RELSourceToEntityIdMapPerson.set(displayName, [
                  ...existingIds,
                  entity.qrCode,
                ])
              }
              const category = entity.relEntries.find((relEntry) =>
                relEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )?.category
              return this.getOtherSources(
                evidence,
                evidenceName,
                undefined,
                category === 'Financial Regulator'
                  ? REL_SOURCE_RELEVANCES[0]
                  : category === 'Law Enforcement'
                  ? REL_SOURCE_RELEVANCES[1]
                  : undefined,
                normalisedEvidenceName
              )
            }),
        },
      ].filter((e) => e.value.length),
      profileImagesUrls: entity.profileImages,
      freetext: entity.notes.map((note) => note.value).join(' '),
      documents: entity.identifiers.map((identifier) => ({
        name: identifier.category,
        id: identifier.value,
        formattedId: identifier.value?.split(' ')[0]?.replace('-', ''),
      })),
      addresses: this.getAddresses(entity.addresses),
    }
  }

  private processBusinessEntity(
    entity: AcurisBusinessEntity,
    entityType: SanctionsEntityType
  ): SanctionsEntity | undefined {
    const sanctionSearchTypes = uniq(
      entity.datasets.map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
    )
    const countryCodes = uniq(
      entity.addresses?.map((a) => a.countryIsoCode)
    ) as CountryCode[]
    const { name, aka, normalizedAka } = getNameAndAka(
      entity.name.toLowerCase(),
      entity.aliases.map((alias) => alias.alias.toLowerCase())
    )
    return {
      id: entity.qrCode,
      name: name,
      entityType: entityType,
      normalizedAka,
      aka,
      types: compact(
        concat(
          entity.datasets.map((dataset) => ACURIS_TYPES[dataset]),
          sanctionSearchTypes
        )
      ),
      // pick evidence name from current.regime.name
      sanctionSearchTypes,
      sanctionsSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'SANCTIONS'
            ) && sanctionSearchTypes.includes('SANCTIONS')
        )
        .map((evidence) => {
          const matchingSanEntry =
            entity.sanEntries.current.find((sanEntry) =>
              sanEntry.events.some((event) =>
                event.evidenceIds.includes(evidence.evidenceId)
              )
            ) ??
            entity.sanEntries.former.find((sanEntry) =>
              sanEntry.events.some((event) =>
                event.evidenceIds.includes(evidence.evidenceId)
              )
            )
          const evidenceName = matchingSanEntry?.regime.name
          const description = matchingSanEntry?.regime.body
          const category = matchingSanEntry
            ? entity.sanEntries.current.some((sanEntry) =>
                sanEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )
              ? SANCTIONS_SOURCE_RELEVANCES[0]
              : SANCTIONS_SOURCE_RELEVANCES[1]
            : undefined
          const displayName = evidenceName ?? 'Other'
          const normalisedEvidenceName = normalizeSource(displayName)
          if (displayName) {
            const existingIds =
              this.SanctionsSourceToEntityIdMapBusiness.get(displayName) || []
            this.SanctionsSourceToEntityIdMapBusiness.set(displayName, [
              ...existingIds,
              entity.qrCode,
            ])
          }
          return this.getOtherSources(
            evidence,
            evidenceName,
            description,
            category,
            normalisedEvidenceName
          )
        }),
      associates: this.getAssociates(entity),
      mediaSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) =>
                EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'ADVERSE_MEDIA'
            ) && sanctionSearchTypes.includes('ADVERSE_MEDIA')
        )
        .map((evidence) => {
          const category = entity.rreEntries.find((rreEntry) =>
            rreEntry.events.some((event) =>
              event.evidenceIds.includes(evidence.evidenceId)
            )
          )?.category
          return this.getMedia(evidence, category)
        }),
      otherSources: [
        {
          type: 'REGULATORY_ENFORCEMENT_LIST',
          value: entity.evidences
            .filter(
              ({ datasets }) =>
                datasets.some(
                  (dataset) =>
                    EXTERNAL_TO_INTERNAL_TYPES[dataset] ===
                    'REGULATORY_ENFORCEMENT_LIST'
                ) && sanctionSearchTypes.includes('REGULATORY_ENFORCEMENT_LIST')
            )
            .map((evidence) => {
              const evidenceName = entity.relEntries.find((relEntry) =>
                relEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )?.subcategory
              const displayName = evidenceName ?? ''
              const normalisedEvidenceName = normalizeSource(displayName)
              if (displayName) {
                const existingIds =
                  this.RELSourceToEntityIdMapBusiness.get(displayName) || []
                this.RELSourceToEntityIdMapBusiness.set(displayName, [
                  ...existingIds,
                  entity.qrCode,
                ])
              }
              const category = entity.relEntries.find((relEntry) =>
                relEntry.events.some((event) =>
                  event.evidenceIds.includes(evidence.evidenceId)
                )
              )?.category
              return this.getOtherSources(
                evidence,
                evidenceName,
                undefined,
                category === 'Financial Regulator'
                  ? REL_SOURCE_RELEVANCES[0]
                  : category === 'Law Enforcement'
                  ? REL_SOURCE_RELEVANCES[1]
                  : undefined,
                normalisedEvidenceName
              )
            }),
        },
      ].filter((e) => e.value.length),
      pepSources: entity.evidences
        .filter(
          ({ datasets }) =>
            datasets.some(
              (dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset] === 'PEP'
            ) && sanctionSearchTypes.includes('PEP')
        )
        .map((evidence) => {
          const evidenceName = entity.evidences.find(
            (e) => e.evidenceId === evidence.evidenceId
          )?.title
          const displayName = evidenceName ?? ''
          const normalisedEvidenceName = normalizeSource(displayName)
          return this.getOtherSources(
            evidence,
            evidenceName,
            undefined,
            'POI',
            normalisedEvidenceName
          )
        }),
      rawResponse: entity,
      profileImagesUrls: entity.profileImages,
      freetext: entity.notes.map((note) => note.value).join(' '),
      documents: entity.identifiers.map((identifier) => ({
        name: identifier.category,
        id: identifier.value,
        formattedId: identifier.value?.split(' ')[0]?.replace('-', ''),
      })),
      addresses: this.getAddresses(entity.addresses),
      isActiveSanctioned: sanctionSearchTypes.includes('SANCTIONS')
        ? Boolean(entity.sanEntries.current.length)
        : undefined,
      nationality: countryCodes,
      countries: compact(countryCodes.map((c) => COUNTRIES[c])),
    }
  }

  private getAssociates(entity: AcurisEntity) {
    const individualLinks = entity.individualLinks.map((link) => ({
      name: this.getEntityName(link, 'PERSON'),
      association: link.relationship,
      sanctionsSearchTypes: uniq(
        link.datasets.map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
      ),
    }))
    const businessLinks = entity.businessLinks.map((link) => ({
      name: this.getEntityName(link, 'BUSINESS'),
      association: link.relationship,
      sanctionsSearchTypes: uniq(
        link.datasets.map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
      ),
    }))
    return [...individualLinks, ...businessLinks]
  }

  private getEntityName<
    T extends {
      name?: string
      firstName?: string
      middleName?: string
      lastName?: string
    }
  >(entity: T, entityType: SanctionsEntityType): string {
    if (entityType === 'PERSON') {
      return compact([
        entity.firstName,
        entity.middleName,
        entity.lastName,
      ]).join(' ')
    }
    if (entityType === 'BUSINESS') {
      return entity.name ?? ''
    }
    return ''
  }

  private getMedia(
    evidence: AcurisEvidence,
    category?: string
  ): SanctionsSource {
    const url = evidence.originalUrl || evidence.assetUrl
    const name = evidence.title || url
    return {
      url,
      createdAt: evidence.captureDateIso
        ? new Date(evidence.captureDateIso).valueOf()
        : undefined,
      name,
      category,
      fields: [
        {
          name: 'Keywords',
          values: [
            evidence.keywords
              ?.split(',')
              .map((keyword) => capitalize(keyword.trim()))
              .join(', '),
          ],
        },
        {
          name: 'Publication date',
          values: [evidence.publicationDateIso],
        },
        {
          name: 'Credibility score',
          values: [evidence.credibility],
        },
        ...(evidence.assetUrl && url !== evidence.assetUrl
          ? [
              {
                name: 'Asset url',
                values: [evidence.assetUrl],
              },
            ]
          : []),
      ].filter((e) => compact(e.values).length),
      media: [
        {
          url,
          title: name,
          snippet: evidence.summary,
        },
      ],
    }
  }

  private getOtherSources(
    evidence: AcurisEvidence,
    evidenceName?: string,
    description?: string,
    category?: string,
    sourceName?: string
  ): SanctionsSource {
    const url = evidence.originalUrl || evidence.assetUrl
    const name = evidenceName || evidence.title || url
    return {
      url,
      createdAt: evidence.captureDateIso
        ? new Date(evidence.captureDateIso).valueOf()
        : undefined,
      name,
      description,
      category,
      sourceName,
      fields: [
        {
          name: 'Title',
          values: [evidence.title],
        },
        {
          name: 'Summary',
          values: [evidence.summary],
        },
        {
          name: 'Keywords',
          values: [
            evidence.keywords
              ?.split(',')
              .map((keyword) => capitalize(keyword.trim()))
              .join(', '),
          ],
        },
        {
          name: 'Publication date',
          values: [evidence.publicationDateIso],
        },
        {
          name: 'Credibility score',
          values: [evidence.credibility],
        },
        ...(evidence.assetUrl && url !== evidence.assetUrl
          ? [
              {
                name: 'Asset url',
                values: [evidence.assetUrl],
              },
            ]
          : []),
      ].filter((e) => compact(e.values).length),
    }
  }

  private getAddresses(
    addresses?: Address[]
  ): SanctionsEntityAddress[] | undefined {
    return addresses?.map((a) => {
      return {
        addressLine: compact([a.line1, a.line2]).join(', '),
        addressType: a.addressType,
        country: a.countryIsoCode as CountryCode,
        city: a.city,
        postalCode: a.postcode,
      }
    })
  }
}
