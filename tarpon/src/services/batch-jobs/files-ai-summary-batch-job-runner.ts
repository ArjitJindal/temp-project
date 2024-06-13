import {
  GetObjectCommandOutput,
  ObjectAttributes,
  S3,
} from '@aws-sdk/client-s3'
import { fromBuffer } from 'file-type'
import PDFParser from 'pdf2json'
import { CaseRepository } from '../cases/repository'
import { AlertsRepository } from '../alerts/repository'
import { UserRepository } from '../users/repositories/user-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import { FilesAISummary } from '@/@types/batch-job'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3Client } from '@/utils/s3'
import { logger } from '@/core/logger'
import { addSentryExtras, updateLogMetadata } from '@/core/utils/context'
import { ask, ModelVersion } from '@/utils/openai'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export const AI_EXTENSIONS = ['pdf'] as const

type AIExtension = (typeof AI_EXTENSIONS)[number]

type Entity = Alert | Case | InternalUser

const NO_SUMMARY_TEXT = 'I cannot summarize this document'

@traceable
export class FilesAiSummaryBatchJobRunner extends BatchJobRunner {
  job?: FilesAISummary
  s3?: S3
  repo?: CaseRepository | AlertsRepository | UserRepository

  public async run(job: FilesAISummary): Promise<void> {
    this.job = job
    updateLogMetadata({ job })
    addSentryExtras({ job })

    const {
      tenantId,
      parameters: { commentId, entityId, type: entityType },
    } = job

    this.s3 = getS3Client(this.job.awsCredentials)
    this.repo = await this.getRepository(tenantId, entityType)

    const entityFunc = this.getRepositoryFunction(this.repo)

    const entity = await entityFunc(entityId)

    if (!entity) {
      return
    }

    const fileInfos = this.getFileInfos(entity, commentId)

    if (!fileInfos.length) {
      return
    }

    await this.processFiles(fileInfos)
  }

  public async getRepository(
    tenantId: string,
    type: FilesAISummary['parameters']['type']
  ): Promise<CaseRepository | AlertsRepository | UserRepository> {
    const mongoDb = await getMongoDbClient()

    if (type === 'CASE') {
      return new CaseRepository(tenantId, { mongoDb })
    } else if (type === 'ALERT') {
      return new AlertsRepository(tenantId, { mongoDb })
    } else if (type === 'USER') {
      return new UserRepository(tenantId, { mongoDb })
    }

    throw new Error('Unsupported repository type')
  }

  private getRepositoryFunction<T>(repo: T) {
    return (id: string) => {
      if (repo instanceof CaseRepository) {
        return repo.getCaseById(id)
      } else if (repo instanceof AlertsRepository) {
        return repo.getAlertById(id)
      } else if (repo instanceof UserRepository) {
        return repo.getUserById(id)
      }
      throw new Error('Unsupported repository type')
    }
  }

  public async getEntity(
    entityRepositories: Record<
      FilesAISummary['parameters']['type'],
      (id: string) => Promise<Entity | null>
    >,
    entityType: string,
    entityId: string
  ) {
    return entityRepositories[entityType]?.(entityId)
  }

  public getFileInfos(entity: Entity, commentId: string): FileInfo[] {
    return (
      entity?.comments?.find((comment) => comment.id === commentId)?.files ?? []
    )
  }

  private async processFiles(fileInfos: FileInfo[]) {
    for (const fileInfo of fileInfos) {
      addSentryExtras({ fileInfo })

      const fileMeta = await this.getFileMeta(fileInfo)
      if (!fileMeta) {
        continue
      }

      const fileSize = fileMeta[ObjectAttributes.OBJECT_SIZE]
      const MAX_FILE_SIZE = 10 * 1024 * 1024

      if (!fileSize || fileSize > MAX_FILE_SIZE) {
        continue
      }

      const file = await this.getFile(fileInfo)
      if (!file) {
        continue
      }

      const buffer = await this.getFileBuffer(file)
      if (!buffer) {
        continue
      }

      const fileType = await this.getFileType(buffer)

      if (
        !fileType ||
        !AI_EXTENSIONS.includes(fileType.ext.toLowerCase() as AIExtension)
      ) {
        continue
      }

      const text = await this.extractText(buffer, fileType.ext as AIExtension)

      if (!text?.length) {
        logger.warn('No text extracted from file', { fileInfo })
        continue
      }

      const prompt = this.promptGenerator(
        text,
        fileType.ext as AIExtension,
        fileInfo
      )

      addSentryExtras({ prompt })

      const data = await this.getAIResponse(prompt)

      if (!data || data.includes(NO_SUMMARY_TEXT)) {
        continue
      }

      await this.updateEntitySummary(fileInfo.s3Key, data)
    }
  }

  public async getFileMeta(fileInfo: FileInfo) {
    const s3 = this.s3 as S3

    return await s3.getObjectAttributes({
      Bucket: fileInfo.bucket,
      Key: fileInfo.s3Key,
      ObjectAttributes: [ObjectAttributes.OBJECT_SIZE],
    })
  }

  private async getFile(fileInfo: FileInfo) {
    const s3 = this.s3 as S3

    return await s3.getObject({
      Bucket: fileInfo.bucket,
      Key: fileInfo.s3Key,
    })
  }

  private async getFileBuffer(file: GetObjectCommandOutput) {
    const bufferArray = await file.Body?.transformToByteArray()
    return bufferArray ? Buffer.from(bufferArray) : null
  }

  private async getFileType(buffer: Buffer) {
    return await fromBuffer(buffer)
  }

  private async extractText(
    file: Buffer,
    extension: AIExtension
  ): Promise<string> {
    const extractors: Record<AIExtension, (file: Buffer) => Promise<string>> = {
      pdf: this.pdfExtractor,
    }
    return await extractors[extension](file)
  }

  private async pdfExtractor(file: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(this, true)

      pdfParser.on('pdfParser_dataError', (errData) => {
        logger.error('Error extracting text from PDF', errData)
        reject(errData)
      })

      pdfParser.on('pdfParser_dataReady', () => {
        const data = pdfParser.getRawTextContent()

        const sanitisedText = data.replace(
          /----------------Page \(\d+\) Break----------------/g,
          ''
        )

        resolve(sanitisedText)
      })

      pdfParser.parseBuffer(file)
    })
  }

  private promptGenerator(
    text: string,
    extension: AIExtension,
    fileInfo: FileInfo
  ) {
    const prompts: Record<
      AIExtension,
      (text: string, fileInfo: FileInfo) => string
    > = {
      pdf: this.pdfPromptGenerator,
    }

    return prompts[extension](text, fileInfo)
  }

  private pdfPromptGenerator(text: string, fileInfo: FileInfo) {
    const trimmedText = text.trim().substring(0, 4000)

    const title = fileInfo.filename

    let prompt = 'This is text extracted from a PDF file:\n'
    prompt += `**${title}**\n\n`
    prompt += '```\n'
    prompt += trimmedText
    prompt += '\n```\n'
    prompt +=
      "Can you provide an overview of the document's content and summarize it in 4-5 sentences?\n"
    prompt +=
      'Please include key details. Aim for a concise, clear, and accurate summary without excessive detail.\n'
    prompt += `If you cannot summarize the document, please respond with "${NO_SUMMARY_TEXT}".\n`

    return prompt
  }

  private async getAIResponse(prompt: string) {
    return await ask(prompt, {
      temperature: 0.7,
      modelVersion: ModelVersion.GPT4O,
    })
  }

  private async updateEntitySummary(s3Key: string, data: string) {
    const {
      parameters: { entityId, commentId },
    } = this.job as FilesAISummary

    await this.repo?.updateAISummary(entityId, commentId, s3Key, data)
  }
}
