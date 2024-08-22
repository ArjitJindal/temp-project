import { Buffer } from 'buffer'
import path from 'path'
import { promises as fs } from 'fs'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import AdmZip from 'adm-zip'
import {
  Action,
  SanctionsDataFetcher,
  SanctionsDataProviderName,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getSecretByName } from '@/utils/secrets-manager'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'

// Define the API endpoint
const apiEndpoint = 'https://djrcfeed.dowjones.com/xml'

// Define the XML parser
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

export class DowJonesDataFetcher implements SanctionsDataFetcher {
  authHeader: string

  static async build() {
    const dowJones = await getSecretByName('dowjones')
    return new DowJonesDataFetcher(dowJones.username, dowJones.password)
  }
  constructor(username: string, password: string) {
    this.authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  }

  provider(): SanctionsDataProviderName {
    return 'dowjones'
  }

  async fullLoad(repo: SanctionsRepository) {
    const filePaths = (await this.getFilePaths()).sort()
    const indexOfLatestFullLoadFile = filePaths
      .map((str, index) => (str.includes('_f.zip') ? index : -1))
      .filter((index) => index !== -1)
      .pop()
    const filesFromFullLoad = filePaths
      .slice(indexOfLatestFullLoadFile)
      .filter((fp) => fp.includes('_f.zip') || fp.includes('_d.zip'))

    for (const file of filesFromFullLoad) {
      const outputDir = await this.downloadZip(file)
      await this.processDirectory(repo, outputDir)
    }
  }

  async delta(repo: SanctionsRepository, from: Date) {
    const filePaths = (await this.getFilePaths()).sort()

    const filteredFiles = filePaths.filter((fp) => {
      const timestamp = fp.split('_')[1]

      return (
        timestamp > dayjs(from).format('YYYYMMDDHHmm') && fp.includes('_d.zip')
      )
    })

    for (const file of filteredFiles) {
      const outputDir = await this.downloadZip(file)
      await this.processDirectory(repo, outputDir)
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

  // Function to save a file to the filesystem
  async saveFile(filePath: string, data: Buffer): Promise<string> {
    const outputPath = path.join('/tmp', 'downloaded_files', filePath)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, data)
    return outputPath
  }

  // Function to read and parse an XML file
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8')
  }

  async downloadZip(filePath: string): Promise<string> {
    const fileResponse = await axios.get(`${apiEndpoint}/${filePath}`, {
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/zip',
      },
      responseType: 'arraybuffer', // Ensure the response is treated as binary data
    })

    const zipBuffer = Buffer.from(fileResponse.data)
    const savedFilePath = await this.saveFile(filePath, zipBuffer)
    const zip = new AdmZip(savedFilePath)
    const outputDir = path.join(
      '/tmp',
      'unzipped_files',
      path.basename(savedFilePath, '.zip')
    )
    zip.extractAllTo(outputDir, true)
    return outputDir
  }

  async processDirectory(repo: SanctionsRepository, outputDir: string) {
    const personPath = `${outputDir}/Factiva_PFA_Feed_XML/${path
      .basename(outputDir)
      .toUpperCase()
      // Hack because the casing is inconsistent here in the given files
      .replace('SPLITS', 'Splits')}/Person`
    const fps = await this.listFilePaths(personPath)
    for (const fp of fps) {
      const jsonObj = await this.readFile(fp)
      await this.fileToEntities(repo, jsonObj)
    }
  }

  async fileToEntities(repo: SanctionsRepository, xml: string) {
    const jsonObj = parser.parse(xml)
    for (const person of jsonObj.PFA.Person) {
      let name = person.NameDetails?.Name
      let otherNames: { FirstName: string; Surname: string }[] = []
      if (Array.isArray(person.NameDetails?.Name)) {
        name = person.NameDetails.Name.find(
          (n) => n['@_NameType'] === 'Primary Name'
        )
        otherNames = person.NameDetails.Name.filter(
          (n) => n['@_NameType'] !== 'Primary Name'
        ).map((name) => name.NameValue)
      }

      if (!name) {
        continue
      }
      const nameValue = name.NameValue

      await repo.save(person['@_action'] as Action, this.provider(), {
        id: person['@_id'],
        name: {
          firstName: nameValue.FirstName,
          surname: nameValue.Surname,
        },
        entityType: 'Person',
        aka: otherNames.map((name) => ({
          firstName: name.FirstName,
          surname: name.Surname,
        })),
      })
    }
  }

  private async listFilePaths(dir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir) // Use fs.promises.readdir
      const filePaths: string[] = []

      for (const file of files) {
        const filePath = path.join(dir, file)
        const stats = await fs.stat(filePath) // Use fs.promises.stat

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
