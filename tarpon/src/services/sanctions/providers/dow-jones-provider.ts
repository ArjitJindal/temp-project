import { Buffer } from 'buffer'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { pipeline } from 'stream'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import unzipper from 'unzipper'
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

// Define the API endpoint
const apiEndpoint = 'https://djrcfeed.dowjones.com/xml'

// Define the XML parser
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (tagName) => {
    return ['Name', 'NameValue', 'Date', 'Country'].includes(tagName)
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
      const subDir = file.includes('_f_splits.zip')
        ? `/Factiva_PFA_Feed_XML/${path
            .basename(outputDir)
            .toUpperCase()
            // Hack because the casing is inconsistent here in the given files
            .replace('SPLITS', 'Splits')}/Person`
        : ''

      await this.processDirectory(repo, version, outputDir, subDir)
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
      await this.processDirectory(repo, version, outputDir)
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
  async readFile(filePath: string): Promise<string> {
    return await fs.promises.readFile(filePath, 'utf8')
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
  async processDirectory(
    repo: SanctionsRepository,
    version: string,
    outputDir: string,
    rootDir = ''
  ) {
    logger.info(`Processing ${outputDir}`)
    const personPath = `${outputDir}${rootDir}`
    const fps = await this.listFilePaths(personPath)
    for (const fp of fps) {
      const jsonObj = await this.readFile(fp)
      await this.fileToEntities(repo, version, jsonObj)
    }
  }

  async fileToEntities(
    repo: SanctionsRepository,
    version: string,
    xml: string
  ) {
    const jsonObj = parser.parse(xml)

    let rawEntities = jsonObj.PFA.Person
    if (!Array.isArray(rawEntities)) {
      rawEntities = [jsonObj.PFA.Person]
    }

    const entities = rawEntities
      .map((person: any): [Action, SanctionsEntity] | undefined => {
        const names = person.NameDetails?.Name
        const name = names.find((n) => n['@_NameType'] === 'Primary Name')
        if (!name) {
          return
        }
        const nameValue = name.NameValue[0]
        const entity: SanctionsEntity = {
          id: person['@_id'],
          name: `${nameValue.FirstName} ${nameValue.Surname}`,
          entityType: 'Person',
          aka: names
            .filter((n) => n['@_NameType'] !== 'Primary Name')
            .flatMap((name) => name.NameValue)
            .map((n) => `${n.FirstName} ${n.Surname}`),
          // TODO these are not actual ISO country code, fix this
          countries: person.CountryDetails?.Country?.filter(
            (country: any) => country['@_CountryType'] === 'Resident of'
          ).map((country) => country.CountryValue?.['@_Code'] as string),
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
}
