import { Buffer } from 'buffer'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { pipeline } from 'stream'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import unzipper from 'unzipper'
import { uniq } from 'lodash'
import { decode } from 'html-entities'
import { COUNTRIES } from '@flagright/lib/constants'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getSecretByName } from '@/utils/secrets-manager'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { SanctionsDataFetcher } from '@/services/sanctions/providers/sanctions-data-fetcher'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { removeUndefinedFields } from '@/utils/object'
import { DOW_JONES_COUNTRIES } from '@/services/sanctions/providers/dow-jones-countries'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'

// Define the API endpoint
const apiEndpoint = 'https://djrcfeed.dowjones.com/xml'

// Define the XML parser
const parser = new XMLParser({
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
    ].includes(tagName)
  },
})

const pipelineAsync = promisify(pipeline)

export class DowJonesProvider extends SanctionsDataFetcher {
  authHeader: string

  static async build() {
    const dowJones = await getSecretByName('dowjones')
    return new DowJonesProvider(dowJones.username, dowJones.password)
  }

  constructor(username: string, password: string) {
    super('dowjones')
    this.authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
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

    for (const file of filesFromFullLoad) {
      const outputDir = await this.downloadZip(file)
      const isSplit = file.includes('_f_splits.zip')

      if (isSplit) {
        await this.processSplitArchive(repo, version, outputDir)
      } else {
        await this.processSingleFile(repo, version, outputDir)
      }
    }
  }

  async delta(repo: SanctionsRepository, version: string, from: Date) {
    const filePaths = (await this.getFilePaths()).sort()

    const filteredFiles = filePaths.filter((fp) => {
      const timestamp = fp.split('_')[1]

      return (
        timestamp > dayjs(from).format('YYYYMMDDHHmm') && fp.includes('_d.zip')
      )
    })

    for (const file of filteredFiles) {
      const outputDir = await this.downloadZip(file)
      await this.processSingleFile(repo, version, outputDir)
    }
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

    const peopleFiles = await this.listFilePaths(`${outputDir}/Person`)
    for (const peopleFile of peopleFiles) {
      const xml = this.readFile(peopleFile)
      await this.fileToEntities(repo, version, xml, masterContext)
    }
    const associationFiles = await this.listFilePaths(
      `${outputDir}/Person_Associations`
    )
    for (const associationFile of associationFiles) {
      const xml = this.readFile(associationFile)
      const jsonObj = parser.parse(xml)
      await this.processAssociations(repo, version, jsonObj.PFA)
    }
  }

  async processSingleFile(
    repo: SanctionsRepository,
    version: string,
    filepath: string
  ) {
    logger.info(`Processing ${filepath}`)
    const peopleFiles = await this.listFilePaths(filepath)
    if (peopleFiles.length == 0) {
      logger.error('No files found in the directory')
      return
    }
    await Promise.all(
      peopleFiles.map(async (peopleFile) => {
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
        await this.fileToEntities(repo, version, xml, contextItems)
      })
    )
    await Promise.all(
      peopleFiles.map(async (peopleFile) => {
        const xml = this.readFile(peopleFile)
        const jsonObj = parser.parse(xml)
        await this.processAssociations(repo, version, jsonObj.PFA.Associations)
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

  private async processAssociations(
    repo: SanctionsRepository,
    version: string,
    root: any
  ) {
    const publicFigures = root.PublicFigure || []
    const associations = publicFigures.map((pf) => {
      return [pf['@_id'], pf.Associate.map((a: any) => a['@_id'])]
    })
    await repo.saveAssociations(this.provider(), associations, version)
  }

  async fileToEntities(
    repo: SanctionsRepository,
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
    const people = jsonObj.PFA.Person ?? jsonObj.PFA.Records.Person
    const entities = people
      .map((person: any): [Action, SanctionsEntity] | undefined => {
        const names = person.NameDetails?.Name
        const name = names.find((n) => n['@_NameType'] === 'Primary Name')
        if (!name) {
          return
        }
        const nameValue = name.NameValue[0]

        // This is a hardcoded mapping of the description1 to the type of screening.
        const sanctionSearchTypes: SanctionsSearchType[] = []
        const descriptions = person.Descriptions?.flatMap((d) => d.Description)
        const descriptionValues = descriptions.map((d) => d['@_Description1'])
        if (descriptionValues?.includes('1')) {
          sanctionSearchTypes.push('PEP')
        }
        if (descriptionValues?.includes('2')) {
          // TODO: Determine how to handle "Relative or Close Associate (RCA)"
          sanctionSearchTypes.push('SANCTIONS')
        }
        if (['3', '4'].some((val) => descriptionValues?.includes(val))) {
          sanctionSearchTypes.push('SANCTIONS')
        }

        const entity: SanctionsEntity = {
          id: person['@_id'],
          name: decode(
            `${nameValue.FirstName} ${nameValue.Surname || ''}`.trim()
          ),
          entityType: 'Person',
          matchTypes: descriptions
            ?.map((d) => {
              if (!masters.Description2List[d['@_Description2']]) {
                return
              }
              return masters.Description2List[d['@_Description2']]['#text']
            })
            .filter(Boolean),
          freetext: person.ProfileNotes,
          sanctionSearchTypes,
          types: descriptions?.map((d) =>
            [
              d['@_Description1']
                ? masters.Description1List[d['@_Description1']]['#text']
                : undefined,
              d['@_Description2']
                ? masters.Description2List[d['@_Description2']]['#text']
                : undefined,
              d['@_Description3']
                ? masters.Description3List[d['@_Description3']]['#text']
                : undefined,
            ]
              .filter(Boolean)
              .join(' - ')
          ),
          screeningSources: person.SourceDescription?.flatMap(
            (sd) => sd.Source
          ).map((sd): SanctionsSource => {
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
              fields: [],
            }
          }),
          gender: person.Gender,
          dateMatched: true,
          aka: names
            .filter((n) => n['@_NameType'] !== 'Primary Name')
            .flatMap((name) => name.NameValue)
            .map((n) => decode(`${n.FirstName} ${n.Surname || ''}`.trim())),
          countries: uniq<string>(
            person.CountryDetails?.Country?.map(
              (country) =>
                DOW_JONES_COUNTRIES[country.CountryValue?.['@_Code'] as string]
            )
          )
            .filter(Boolean)
            .map((c) => COUNTRIES[c]),
          yearOfBirth: person.DateDetails?.Date?.find(
            (date: any) => date['@_DateType'] === 'Date of Birth'
          )?.DateValue['@_Year'] as string,
        }

        return [
          person['@_action'] as Action,
          removeUndefinedFields(entity) as SanctionsEntity,
        ]
      })
      .filter(Boolean)

    await repo.save(this.provider(), entities, version)
  }
  private async listFilePaths(dir: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dir)
      const filePaths: string[] = []

      for (const file of files) {
        const filePath = path.join(dir, file)
        const stats = await fs.promises.stat(filePath)

        if (stats.isFile()) {
          filePaths.push(filePath)
        }
      }

      return filePaths
    } catch (err) {
      console.error('Error reading directory:', err)
      return []
    }
  }

  async checkCountries(path: string) {
    const latestDowJonesCountryFile = this.readFile(path)
    const jsonObj = parser.parse(latestDowJonesCountryFile)
    const countries: { '@_code': string; '@_name': string }[] =
      jsonObj.PFA.CountryList.CountryName
    const missingCountry = countries
      .map((c) => c['@_code'])
      .filter((code) => DOW_JONES_COUNTRIES[code] === undefined)
    if (missingCountry.length > 0) {
      const message = `These dow jones countries are not up to date: ${missingCountry.join(
        ', '
      )}`
      throw new Error(message)
    }
  }
}
