import { compact, concat, startCase, uniq } from 'lodash'
import { COUNTRIES } from '@flagright/lib/constants'
import { getUniqueStrings, shouldLoadScreeningData } from './utils'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { traceable } from '@/core/xray'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { OpenSanctionsSearchType } from '@/@types/openapi-internal/OpenSanctionsSearchType'
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/OpenSanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'
type OpenSanctionsLine = {
  op: string
  entity: OpenSanctionsPersonEntity
}

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
}

type OpenSanctionsOrganizationEntity = OpenSanctionsEntity & {
  properties: OpenSanctionsOrgProperties
}

@traceable
export class OpenSanctionsProvider extends SanctionsDataFetcher {
  private types: OpenSanctionsSearchType[]
  private entityTypes: SanctionsEntityType[]
  static async build(
    tenantId: string,
    settings?: SanctionsSettingsProviderScreeningTypes
  ) {
    let types: OpenSanctionsSearchType[] | undefined
    let entityTypes: SanctionsEntityType[] | undefined
    if (settings) {
      types = settings.screeningTypes as OpenSanctionsSearchType[]
      entityTypes = settings.entityTypes as SanctionsEntityType[]
    } else {
      const tenantRepository = new TenantRepository(tenantId, {
        dynamoDb: getDynamoDbClient(),
      })
      const { sanctions } = await tenantRepository.getTenantSettings([
        'sanctions',
      ])
      const openSanctionSettings = sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'open-sanctions'
      )
      if (openSanctionSettings) {
        types = openSanctionSettings.screeningTypes as OpenSanctionsSearchType[]
        entityTypes = openSanctionSettings.entityTypes as SanctionsEntityType[]
      }
    }
    return new OpenSanctionsProvider(
      tenantId,
      types ?? OPEN_SANCTIONS_SEARCH_TYPES,
      entityTypes ?? SANCTIONS_ENTITY_TYPES
    )
  }

  constructor(
    tenantId: string,
    types: OpenSanctionsSearchType[],
    entityTypes: SanctionsEntityType[]
  ) {
    super('open-sanctions', tenantId)
    this.types = types
    this.entityTypes = entityTypes
  }

  async fullLoad(repo: SanctionsRepository, version: string) {
    if (!shouldLoadScreeningData(this.types, this.entityTypes)) {
      return
    }
    return this.processUrl(
      repo,
      version,
      'https://data.opensanctions.org/datasets/latest/default/entities.ftm.json'
    )
  }

  async delta(repo: SanctionsRepository, version: string, from: Date) {
    if (!shouldLoadScreeningData(this.types, this.entityTypes)) {
      return
    }
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
      if (entities.length > 1000) {
        await repo.save('open-sanctions', entities, version)
        logger.info(`Saved ${entities.length} entities`)
        entities = []
      }
    })
    if (entities.length) {
      await repo.save('open-sanctions', entities, version)
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
      if (entities.length > 1000) {
        await repo.save('open-sanctions', entities, version)
        logger.info(`Saved ${entities.length} entities`)
        entities = []
      }
    })
    if (entities.length) {
      await repo.save('open-sanctions', entities, version)
      logger.info(`Saved ${entities.length} entities`)
      entities = []
    }
  }

  private transformPersonEntity(
    entity: OpenSanctionsPersonEntity,
    sanctionSearchTypes: OpenSanctionsSearchType[]
  ): SanctionsEntity | undefined {
    const properties = entity.properties
    if (!this.entityTypes.includes('PERSON')) {
      return undefined
    }
    return {
      id: entity.id,
      aka: getUniqueStrings(
        compact(
          concat(properties.alias || [], properties.name || []).map((n) =>
            n.toLowerCase()
          )
        ).map((n) => startCase(n))
      ),
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
      name: startCase(entity.caption?.toLowerCase() ?? 'Unknown'),
      nationality: (properties.nationality?.map((c) =>
        c.toUpperCase()
      ) as CountryCode[]) || ['ZZ'],
      sanctionSearchTypes,
      screeningSources: properties.sourceUrl?.map((source) => ({
        url: source,
        name: source,
      })),
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
      isActiveSanctioned: undefined,
    }
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
    return {
      id: entity.id,
      name: startCase(entity.caption?.toLowerCase() ?? 'Unknown'),
      entityType: schema,
      aka: getUniqueStrings(
        compact(
          concat(properties.alias || [], properties.name || []).map((n) =>
            n.toLowerCase()
          )
        ).map((n) => startCase(n))
      ),
      sanctionSearchTypes,
      types: concat(
        entity.datasets || [],
        entity.referents || [],
        sanctionSearchTypes
      ),
      freetext: properties.notes?.join('\n') || '',
      sanctionsSources: properties.sourceUrl?.map((source) => ({
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
              return 'PEP'
            case 'sanction':
            case 'sanction.linked':
            case 'sanction.counter':
              return 'SANCTIONS'
            case 'poi':
              return 'PEP'
          }
        })
      ).filter((type) => this.types.includes(type))
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
