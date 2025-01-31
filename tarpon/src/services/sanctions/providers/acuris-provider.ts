import { Readable } from 'stream'
import { createInterface } from 'readline'
import { capitalize, compact, concat, intersection } from 'lodash'
import { COUNTRIES } from '@flagright/lib/constants'
import { shouldLoadScreeningData } from './utils'
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
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'
import { getSecretByName } from '@/utils/secrets-manager'
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/AcurisSanctionsSearchType'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'

const EXTERNAL_TO_INTERNAL_TYPES: Record<string, AcurisSanctionsSearchType> = {
  'PEP-CURRENT': 'PEP',
  'PEP-FORMER': 'PEP',
  'PEP-LINKED': 'PEP',
  'SAN-CURRENT': 'SANCTIONS',
  'SAN-FORMER': 'SANCTIONS',
  'SOE-FORMER': 'PEP',
  'SOE-CURRENT': 'PEP',
  RRE: 'ADVERSE_MEDIA',
  POI: 'PROFILE_OF_INTEREST',
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
  addresses: string[]
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
    previous: SanctionEntry[]
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

@traceable
export class AcurisProvider extends SanctionsDataFetcher {
  private apiKey: string
  private uri: string = 'https://api.acuris.com/compliance-datafeed'
  private screeningTypes: AcurisSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]
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
      const tenantRepository = new TenantRepository(tenantId, {
        dynamoDb: getDynamoDbClient(),
      })
      const { sanctions } = await tenantRepository.getTenantSettings([
        'sanctions',
      ])
      const acurisSettings = sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'acuris'
      )
      if (acurisSettings) {
        types = acurisSettings?.screeningTypes as AcurisSanctionsSearchType[]
        entityTypes = acurisSettings?.entityTypes as SanctionsEntityType[]
      }
    }
    const apiKey = (await getSecretByName('acuris'))?.apiKey
    if (!apiKey) {
      throw new Error('Acuris API key not found')
    }
    return new AcurisProvider(
      tenantId,
      apiKey,
      types ?? ACURIS_SANCTIONS_SEARCH_TYPES,
      entityTypes ?? SANCTIONS_ENTITY_TYPES
    )
  }

  constructor(
    tenantId: string,
    apiKey: string,
    screeningTypes: AcurisSanctionsSearchType[],
    entityTypes: SanctionsEntityType[]
  ) {
    super('acuris', tenantId)
    this.apiKey = apiKey
    this.screeningTypes = screeningTypes
    this.entityTypes = entityTypes
  }

  async fullLoad(repo: SanctionsRepository, version: string) {
    if (!shouldLoadScreeningData(this.screeningTypes, this.entityTypes)) {
      return
    }
    const types = this.getEntityTypesToLoad()
    for (const type of types) {
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
      const rl = createInterface({
        input: bodyStream,
        crlfDelay: Infinity,
      })
      let lc = 0
      let entities: [Action, SanctionsEntity][] = []
      for await (const line of rl) {
        const entity = JSON.parse(line)
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
        lc++
        if (entities.length > 1000) {
          await repo.save('acuris', entities, version)
          logger.info(`Processed ${lc} entities`)
          entities = []
        }
      }
      if (entities.length) {
        await repo.save('acuris', entities, version)
      }
    }
  }

  private getEntityTypesToLoad() {
    return [
      ...(this.entityTypes.includes('PERSON') ? ['individuals'] : []),
      ...(this.entityTypes.includes('BUSINESS') ? ['businesses'] : []),
    ]
  }

  async delta(repo: SanctionsRepository, version: string, from: Date) {
    if (!shouldLoadScreeningData(this.screeningTypes, this.entityTypes)) {
      return
    }
    const types = this.getEntityTypesToLoad()
    for (const type of types) {
      const response = await fetch(
        `${this.uri}/${type}/delta?timestamp=${from.getTime()}`,
        {
          headers: {
            'x-api-key': this.apiKey,
            'content-type': 'application/json',
          },
        }
      )
      const data = await response.json()
      let entities: [Action, SanctionsEntity][] = []
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
          await repo.save('acuris', entities, version)
          logger.info(`Processed ${entities.length} entities`)
          entities = []
        }
      }
      if (entities.length) {
        await repo.save('acuris', entities, version)
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

  private hasScreeningType(type: AcurisSanctionsSearchType) {
    return this.screeningTypes.includes(type)
  }

  private processIndividualEntity(
    entity: AcurisIndividualEntity,
    entityType: SanctionsEntityType
  ): SanctionsEntity | undefined {
    const pepTier = entity.pepEntries.pepTier
    const sanctionSearchTypes = entity.datasets
      .map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
      .filter((type) => this.hasScreeningType(type))
    if (!intersection(sanctionSearchTypes, this.screeningTypes).length) {
      return
    }

    return {
      id: entity.qrCode,
      name: this.getEntityName(entity, entityType),
      entityType: entityType,
      types: concat(
        entity.datasets
          .filter((dataset) =>
            this.hasScreeningType(EXTERNAL_TO_INTERNAL_TYPES[dataset])
          )
          .map((dataset) => ACURIS_TYPES[dataset]),
        sanctionSearchTypes
      ),
      sanctionSearchTypes,
      gender: entity.gender,
      aka: entity.aliases.map((alias) => this.getEntityName(alias, entityType)),
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
      yearOfBirth: entity.datesOfBirthIso?.map((date) =>
        dayjs(date).format('YYYY')
      ),
      dateOfBirths: entity.datesOfBirthIso,
      isDeseased: entity.isDeseased,
      isActiveSanctioned: this.hasScreeningType('SANCTIONS')
        ? Boolean(entity.sanEntries.current.length)
        : undefined,
      isActivePep: this.hasScreeningType('PEP')
        ? Boolean(entity.pepEntries.current.length)
        : undefined,
      sanctionsSources: this.hasScreeningType('SANCTIONS')
        ? entity.evidences
            .filter(
              ({ evidenceId }) =>
                entity.sanEntries.current.some((sanEntry) =>
                  sanEntry.events.some((event) =>
                    event.evidenceIds.includes(evidenceId)
                  )
                ) && sanctionSearchTypes.includes('SANCTIONS')
            )
            .map((evidence) => this.getOtherSources(evidence))
        : [],
      pepSources: this.hasScreeningType('PEP')
        ? entity.evidences
            .filter(
              ({ evidenceId }) =>
                entity.pepEntries.current.some((pepEntry) =>
                  pepEntry.evidenceIds.includes(evidenceId)
                ) && sanctionSearchTypes.includes('PEP')
            )
            .map((evidence) => this.getOtherSources(evidence))
        : [],
      associates: entity.individualLinks.map((link) => ({
        name: this.getEntityName(link, entityType),
        association: link.relationship,
        sanctionsSearchTypes: link.datasets
          .map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
          .filter((type) => this.hasScreeningType(type)),
      })),
      mediaSources: this.hasScreeningType('ADVERSE_MEDIA')
        ? entity.evidences
            .filter(({ evidenceId }) =>
              entity.rreEntries.some((rreEntry) =>
                rreEntry.events.some((event) =>
                  event.evidenceIds.includes(evidenceId)
                )
              )
            )
            .map((evidence) => this.getMedia(evidence))
        : [],
      rawResponse: entity,
      otherSources: [
        ...(this.hasScreeningType('PROFILE_OF_INTEREST')
          ? [
              {
                type: 'PROFILE_OF_INTEREST',
                value: entity.evidences
                  .filter(({ evidenceId }) =>
                    entity.poiEntries
                      .flatMap(({ evidenceIds }) => evidenceIds)
                      .includes(evidenceId)
                  )
                  .map((evidence) => this.getOtherSources(evidence)),
              },
            ]
          : []),
        ...(this.hasScreeningType('REGULATORY_ENFORCEMENT_LIST')
          ? [
              {
                type: 'REGULATORY_ENFORCEMENT_LIST',
                value: entity.evidences
                  .filter(({ evidenceId }) =>
                    entity.relEntries.some((relEntry) =>
                      relEntry.events.some((event) =>
                        event.evidenceIds.includes(evidenceId)
                      )
                    )
                  )
                  .map((evidence) => this.getOtherSources(evidence)),
              },
            ]
          : []),
      ].filter((e) => e.value.length),
      profileImagesUrls: entity.profileImages,
      freetext: entity.notes.map((note) => note.value).join(' '),
      documents: entity.identifiers.map((identifier) => ({
        name: identifier.category,
        id: identifier.value,
        formattedId: identifier.value?.split(' ')[0]?.replace('-', ''),
      })),
    }
  }
  private processBusinessEntity(
    entity: AcurisBusinessEntity,
    entityType: SanctionsEntityType
  ): SanctionsEntity | undefined {
    const sanctionSearchTypes = entity.datasets
      .map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
      .filter((type) => this.hasScreeningType(type))
    if (!intersection(sanctionSearchTypes, this.screeningTypes).length) {
      return
    }
    return {
      id: entity.qrCode,
      name: this.getEntityName(entity, entityType),
      entityType: entityType,
      types: concat(
        entity.datasets
          .filter((dataset) =>
            this.hasScreeningType(EXTERNAL_TO_INTERNAL_TYPES[dataset])
          )
          .map((dataset) => ACURIS_TYPES[dataset]),
        sanctionSearchTypes
      ),
      sanctionSearchTypes,
      sanctionsSources: this.hasScreeningType('SANCTIONS')
        ? entity.evidences
            .filter(({ evidenceId }) =>
              entity.sanEntries.current.some((sanEntry) =>
                sanEntry.events.some((event) =>
                  event.evidenceIds.includes(evidenceId)
                )
              )
            )
            .map((evidence) => this.getOtherSources(evidence))
        : [],
      associates: entity.businessLinks.map((link) => ({
        name: this.getEntityName(link, entityType),
        association: link.relationship,
        sanctionsSearchTypes: link.datasets
          .map((dataset) => EXTERNAL_TO_INTERNAL_TYPES[dataset])
          .filter((type) => this.hasScreeningType(type)),
      })),
      mediaSources: this.hasScreeningType('ADVERSE_MEDIA')
        ? entity.evidences
            .filter(({ evidenceId }) =>
              entity.rreEntries.some((rreEntry) =>
                rreEntry.events.some((event) =>
                  event.evidenceIds.includes(evidenceId)
                )
              )
            )
            .map((evidence) => this.getMedia(evidence))
        : [],
      otherSources: [
        ...(this.hasScreeningType('PROFILE_OF_INTEREST')
          ? [
              {
                type: 'PROFILE_OF_INTEREST',
                value: entity.evidences
                  .filter(({ evidenceId }) =>
                    entity.poiEntries
                      .flatMap(({ evidenceIds }) => evidenceIds)
                      .includes(evidenceId)
                  )
                  .map((evidence) => this.getOtherSources(evidence)),
              },
            ]
          : []),
        ...(this.hasScreeningType('REGULATORY_ENFORCEMENT_LIST')
          ? [
              {
                type: 'REGULATORY_ENFORCEMENT_LIST',
                value: entity.evidences
                  .filter(({ evidenceId }) =>
                    entity.relEntries.some((relEntry) =>
                      relEntry.events.some((event) =>
                        event.evidenceIds.includes(evidenceId)
                      )
                    )
                  )
                  .map((evidence) => this.getOtherSources(evidence)),
              },
            ]
          : []),
      ].filter((e) => e.value.length),
      rawResponse: entity,
      profileImagesUrls: entity.profileImages,
      freetext: entity.notes.map((note) => note.value).join(' '),
      documents: entity.identifiers.map((identifier) => ({
        name: identifier.category,
        id: identifier.value,
        formattedId: identifier.value?.split(' ')[0]?.replace('-', ''),
      })),
      yearOfBirth: entity.datesOfBirthIso?.map((date) =>
        dayjs(date).format('YYYY')
      ),
    }
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

  private getMedia(evidence: AcurisEvidence): SanctionsSource {
    const url = evidence.originalUrl || evidence.assetUrl
    const name = evidence.title || url
    return {
      url,
      createdAt: evidence.captureDateIso
        ? new Date(evidence.captureDateIso).valueOf()
        : undefined,
      name,
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

  private getOtherSources(evidence: AcurisEvidence): SanctionsSource {
    const url = evidence.originalUrl || evidence.assetUrl
    const name = evidence.title || url
    return {
      url,
      createdAt: evidence.captureDateIso
        ? new Date(evidence.captureDateIso).valueOf()
        : undefined,
      name,
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
}
