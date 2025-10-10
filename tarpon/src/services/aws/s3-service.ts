import {
  CopyObjectCommand,
  GetObjectTaggingCommand,
  GetObjectTaggingCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3'
import { BadRequest, InternalServerError } from 'http-errors'
import find from 'lodash/find'
import isUndefined from 'lodash/isUndefined'
import { backOff } from 'exponential-backoff'
import { getFlatFileErrorRecordS3Key } from '@flagright/lib/utils'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { logger } from '@/core/logger'
import { MAX_FILE_SIZE_BYTES } from '@/core/constants'
import { envIs } from '@/utils/env'

export type S3Config = {
  tmpBucketName: string
  documentBucketName: string
}

class MissingTagError extends Error {}

export class S3Service {
  private static readonly S3_OBJECT_GUARD_DUTY_TAG =
    'GuardDutyMalwareScanStatus'

  protected s3: S3
  protected s3Config: S3Config

  constructor(s3: S3, s3Config: S3Config) {
    this.s3 = s3
    this.s3Config = s3Config
  }

  /**
   *
   * @description This function validates if the file is threat free. We are using GuardDuty to scan the files uploaded
   * to S3. GuardDuty will add a tag to the object with the key `GuardDutyMalwareScanStatus` and value `THREATS_FOUND` if
   * the file is detected as a threat. If the file is threat free, the value will be `NO_THREATS_FOUND`.
   */
  private async validateFileThreat(file: FileInfo) {
    let response: GetObjectTaggingCommandOutput | undefined
    try {
      const objectTaggingCommand = new GetObjectTaggingCommand({
        Bucket: this.s3Config.tmpBucketName,
        Key: file.s3Key,
      })
      response = await this.s3.send(objectTaggingCommand)
    } catch (e) {
      if (
        (e as any)?.name === 'NoSuchKey' ||
        (e as any)?.name === 'AccessDenied'
      ) {
        throw new BadRequest('Invalid s3Key in files')
      }

      throw new InternalServerError('Something went wrong')
    }

    const guardDutyTag = find(response.TagSet, {
      Key: S3Service.S3_OBJECT_GUARD_DUTY_TAG,
    })
    // Ref - https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html#enable-optional-tagging-malware-protection-s3
    switch (guardDutyTag?.Value) {
      case 'THREATS_FOUND':
        throw new BadRequest(
          `Malware is detected in the file: ${file.filename}`
        )
      case 'NO_THREATS_FOUND':
        return
      case undefined:
        throw new MissingTagError()
      default:
        logger.error(
          `Unknown GuardDuty tag value: ${guardDutyTag?.Value} for file: ${file.s3Key}`
        )
      // Defer from throwing this error for now. We'll monitor it or make it stricter if needed
      // throw new createError.InternalServerError('Something went wrong')
    }
  }

  /**
   *
   * @description This function validates if the file size is within the limit
   */
  private async validateFileSize(file: FileInfo) {
    const headObjectCommand = new HeadObjectCommand({
      Bucket: this.s3Config.tmpBucketName,
      Key: file.s3Key,
    })
    const response = await this.s3.send(headObjectCommand)
    const fileSize = response.ContentLength
    if (isUndefined(fileSize)) {
      // Ideally, this should never happen
      logger.error(
        `File size is undefined for file: ${file.s3Key}. This should never happen`
      )
      throw new InternalServerError('Something went wrong')
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequest(`File size is too large: ${file.filename}`)
    }
  }

  private async validateFiles(files: FileInfo[]) {
    await Promise.all(
      files.map(async (file) => {
        return await Promise.all([
          // Validate if the file is threat free
          backOff(
            async () => {
              await this.validateFileThreat(file)
            },
            {
              startingDelay: 1000,
              maxDelay: 5 * 1000,
              numOfAttempts: 5,
              retry: (e) => e instanceof MissingTagError,
            }
          ),
          // Validate if the file is within the size limit
          this.validateFileSize(file),
        ])
      })
    )
  }

  public async copyFilesToPermanentBucket(
    files: FileInfo[]
  ): Promise<FileInfo[]> {
    if (envIs('test')) {
      return files
    }

    // Validate the files
    await this.validateFiles(files)

    // Copy the files from tmp bucket to document bucket
    for (const file of files) {
      const copyObjectCommand = new CopyObjectCommand({
        CopySource: `${this.s3Config.tmpBucketName}/${file.s3Key}`,
        Bucket: this.s3Config.documentBucketName,
        Key: file.s3Key,
      })
      try {
        await this.s3.send(copyObjectCommand)
      } catch (error) {
        if (
          (error as any)?.name === 'NoSuchKey' ||
          (error as any)?.name === 'AccessDenied'
        ) {
          throw new BadRequest('Invalid s3Key in files')
        }
      }
    }

    return files.map((file) => ({
      ...file,
      bucket: this.s3Config.documentBucketName,
    }))
  }

  public async copyFlatFilesToPermanentBucket(
    files: FileInfo[]
  ): Promise<FileInfo[]> {
    if (envIs('test')) {
      return files
    }
    const s3Files = await this.copyFilesToPermanentBucket(files)

    // creating the errors file when staring the flat file import batch job
    // this way when we complete the import we can directly write to this s3key with errored records we don't need to store s3Key for errored recrod
    // as it can dervied from original file s3Key
    const errorFiles = s3Files.map((file) => ({
      s3Key: getFlatFileErrorRecordS3Key(file.s3Key),
    }))

    for (const file of errorFiles) {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.s3Config.documentBucketName,
        Key: file.s3Key,
      })
      try {
        await this.s3.send(putObjectCommand)
      } catch (error) {
        if (
          (error as any)?.name === 'NoSuchKey' ||
          (error as any)?.name === 'AccessDenied'
        ) {
          throw new BadRequest('Invalid s3Key in files')
        }
      }
    }
    return s3Files
  }
}
