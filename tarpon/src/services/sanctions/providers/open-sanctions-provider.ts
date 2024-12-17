import { uniq } from 'lodash'
import { SanctionsRepository } from '@/services/sanctions/providers/types'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { traceable } from '@/core/xray'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'

type OpenSanctionsLine = {
  op: string
  entity: OpenSanctionsEntity
}

type OpenSanctionsEntity = {
  id: string
  caption?: string
  schema?: string
  properties: {
    name?: string[]
    addressEntity?: string[]
    secondName?: string[]
    topics?: string[]
    gender?: string[]
    createdAt?: string[]
    lastName?: string[]
    firstName?: string[]
    country?: string[]
    birthDate?: string[]
    middleName?: string[]
    citizenship?: string[]
    alias?: string[]
    birthPlace?: string[]
    sourceUrl?: string[]
    position?: string[]
    notes?: string[]
    fatherName?: string[]
    address?: string[]
    nationality?: string[]
    modifiedAt?: string[]
    birthCountry?: string[]
  }
  referents?: string[]
  datasets?: string[]
  first_seen?: string
  last_seen?: string
  last_change?: string
  target?: boolean
}

@traceable
export class OpenSanctionsProvider extends SanctionsDataFetcher {
  static async build(tenantId: string) {
    return new OpenSanctionsProvider(tenantId)
  }

  constructor(tenantId: string) {
    super('open-sanctions', tenantId)
  }

  async fullLoad(repo: SanctionsRepository, version: string) {
    return this.processUrl(
      repo,
      version,
      'https://data.opensanctions.org/datasets/latest/default/entities.ftm.json'
    )
  }

  async delta(repo: SanctionsRepository, version: string, from: Date) {
    const metadata = await fetch(
      'https://data.opensanctions.org/datasets/latest/sanctions/index.json'
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
    const urls: string[] = Object.values(json['versions'])

    return urls.filter((str) => {
      // Extract the timestamp part (before the '-')
      const timestampPart = str.split('-')[0].split('/').pop() || ''
      // Convert the timestamp to a Date object
      const timestampDate = new Date(
        parseInt(timestampPart.slice(0, 4)), // Year
        parseInt(timestampPart.slice(4, 6)) - 1, // Month (0-based)
        parseInt(timestampPart.slice(6, 8)), // Day
        parseInt(timestampPart.slice(8, 10)), // Hours
        parseInt(timestampPart.slice(10, 12)), // Minutes
        parseInt(timestampPart.slice(12, 14)) // Seconds
      )
      // Compare the dates
      return timestampDate >= from
    })
  }

  private async processDeltaUrl(
    repo: SanctionsRepository,
    version: string,
    url: string
  ) {
    await streamResponseLines(url, async (line) => {
      const parsedLine: OpenSanctionsLine = JSON.parse(line)

      // TODO Handle this
      if (parsedLine.op === 'DEL' || !parsedLine.entity.properties.name) {
        return
      }

      const entity = parsedLine.entity

      const sanctionsEntity = transformInput(entity)
      switch (parsedLine.op) {
        case 'ADD':
        case 'MOD':
          await repo.save('open-sanctions', [['add', sanctionsEntity]], version)
          break
        default:
          throw new Error(`Unknown operation ${parsedLine.op}`)
      }
    })
  }
  private async processUrl(
    repo: SanctionsRepository,
    version: string,
    url: string
  ) {
    await streamResponseLines(url, async (line) => {
      const entity: OpenSanctionsEntity | undefined = JSON.parse(line)

      // TODO Handle this
      if (!entity?.properties?.name) {
        return
      }

      const sanctionsEntity = transformInput(entity)
      await repo.save('open-sanctions', [['add', sanctionsEntity]], version)
    })
  }
}

export function transformInput(entity: OpenSanctionsEntity): SanctionsEntity {
  const properties = entity.properties
  return {
    id: entity.id,
    aka: properties.alias || [],
    countries: properties.country || [],
    countryCodes: (properties.citizenship?.map((c) =>
      c.toUpperCase()
    ) as CountryCode[]) || ['ZZ'],
    documents: [],
    entityType: entity.schema || '',
    freetext: properties.notes?.join('\n') || '',
    gender: properties.gender?.[0] || 'Unknown',
    matchTypes: [],
    name: properties.name?.at(0) || 'Unknown',
    nationality: (properties.nationality?.map((c) =>
      c.toUpperCase()
    ) as CountryCode[]) || ['ZZ'],
    sanctionSearchTypes: uniq(
      properties.topics?.map((topic) => {
        switch (topic) {
          // TODO handle each differently
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
          case 'wanted':
          case 'corp.offshore':
          case 'corp.shell':
          case 'corp.public':
          case 'corp.disqual':
          case 'gov':
          case 'gov.national':
          case 'gov.state':
          case 'gov.muni':
          case 'gov.soe':
          case 'gov.igo':
          case 'gov.head':
          case 'gov.admin':
          case 'gov.executive':
          case 'gov.legislative':
          case 'gov.judicial':
          case 'gov.security':
          case 'gov.financial':
          case 'fin':
          case 'fin.bank':
          case 'fin.fund':
          case 'fin.adivsor':
          case 'reg.action':
          case 'reg.warn':
          case 'role.pep':
          case 'role.pol':
          case 'role.rca':
          case 'role.judge':
          case 'role.civil':
          case 'role.diplo':
          case 'role.lawyer':
          case 'role.acct':
          case 'role.spy':
          case 'role.oligarch':
          case 'role.journo':
          case 'role.act':
          case 'role.lobby':
          case 'pol.party':
          case 'pol.union':
          case 'rel':
          case 'mil':
          case 'asset.frozen':
          case 'sanction':
          case 'sanction.linked':
          case 'sanction.counter':
          case 'export.control':
          case 'export.risk':
          case 'debarment':
          case 'poi':
            return 'SANCTIONS'
          default:
            throw new Error(`Unknown topic ${topic}`)
        }
      })
    ),
    screeningSources: properties.sourceUrl?.map((source) => ({ url: source })),
    types: [],
    yearOfBirth: properties.birthDate?.[0]?.split('-')[0] || 'Unknown',
    updatedAt: Date.now(),
  }
}

async function streamResponseLines(
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
