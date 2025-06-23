import Ajv, { ValidateFunction, ErrorObject } from 'ajv'
import { JSONSchema } from 'json-schema-to-typescript'
import { FlatFileRunner } from '../runner'
import { EntityModel } from '@/@types/model'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'
import { generateJsonSchemaFromEntityClass } from '@/utils/json-schema'
import {
  FlatFilesRecordsError,
  FlatFileValidationResult,
  FlatFileRecord,
  FlatFilesErrorStage,
} from '@/@types/flat-files'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { getClickhouseCredentials } from '@/utils/clickhouse/utils'
import { asyncIterableBatchProcess } from '@/utils/batch-processor'
import { logger } from '@/core/logger'

export abstract class FlatFileFormat {
  model: typeof EntityModel
  s3Key: string
  tenantId: string
  protected readonly BATCH_SIZE = 1000

  constructor(tenantId: string, model: typeof EntityModel, s3Key: string) {
    this.model = model
    this.s3Key = s3Key
    this.tenantId = tenantId
  }

  static readonly format: FlatFileTemplateFormat
  abstract getTemplate(): FlatFileTemplateResponse
  abstract readAndParse(s3Key: string): AsyncGenerator<FlatFileRecord>

  public generateJSONSchema(): JSONSchema {
    return generateJsonSchemaFromEntityClass(this.model)
  }

  protected async validateRecord(
    data: FlatFileRecord,
    validate: ValidateFunction,
    runner: FlatFileRunner<any>,
    metadata?: object
  ): Promise<FlatFileValidationResult> {
    try {
      // First validate against JSON schema
      const ajvResult = validate(data.record)
      if (!ajvResult) {
        const errors = this.formatValidationErrors(validate.errors)
        return { valid: false, errors, record: data }
      }

      // Then validate using runner's custom validation
      const validationResult = await runner.validate(data.record, metadata)
      return {
        valid: validationResult.valid,
        errors: validationResult.errors,
        record: data,
      }
    } catch (error) {
      logger.error(`Validation failed for record ${data.index}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        recordId: data.index,
        fileId: this.s3Key,
      })
      return {
        valid: false,
        errors: [
          {
            keyword: 'VALIDATION_ERROR',
            message:
              error instanceof Error
                ? error.message
                : 'Unknown validation error',
            stage: 'VALIDATE',
          },
        ],
        record: data,
      }
    }
  }

  protected formatValidationErrors(
    errors: ErrorObject[] | null | undefined
  ): FlatFilesRecordsError[] {
    return (
      errors?.map((error) => ({
        instancePath: error.instancePath,
        keyword: error.keyword,
        message: error.message ?? '',
        params: JSON.stringify(error.params),
        stage: 'VALIDATE',
      })) ?? []
    )
  }

  public async *validateRecords(
    runner: FlatFileRunner<any>,
    metadata?: object
  ): AsyncGenerator<FlatFileValidationResult> {
    const schema = this.generateJSONSchema()
    const ajv = new Ajv({ allErrors: true })
    const validate = ajv.compile(schema)

    yield* asyncIterableBatchProcess(this.readAndParse(this.s3Key), {
      concurrency: runner.concurrency,
      processor: (data) =>
        this.validateRecord(data, validate, runner, metadata),
    })
  }

  protected async createRecord(
    flatFilesRecords: FlatFilesRecords,
    data: FlatFileValidationResult
  ): Promise<void> {
    try {
      flatFilesRecords.create({
        createdAt: Date.now(),
        updatedAt: Date.now(),
        error: data.errors,
        fileId: this.s3Key,
        isError: !data.valid,
        isProcessed: false,
        initialRecord: JSON.stringify(data.record.record),
        parsedRecord: JSON.stringify(data.record.record),
        row: data.record.index,
        stage: 'VALIDATE',
      })
    } catch (error) {
      logger.error(
        `Failed to create flat files record for record ${data.record.index}`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          recordId: data.record.index,
          fileId: this.s3Key,
        }
      )
      throw error // Re-throw to handle in the calling method
    }
  }

  protected async saveRecords(
    flatFilesRecords: FlatFilesRecords,
    force: boolean = false
  ): Promise<void> {
    try {
      if (force || flatFilesRecords.getBulkValuesSize() >= this.BATCH_SIZE) {
        await flatFilesRecords.save()
      }
    } catch (error) {
      logger.error('Failed to save flat files records', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileId: this.s3Key,
        batchSize: flatFilesRecords.getBulkValuesSize(),
      })
      throw error // Re-throw to handle in the calling method
    }
  }

  protected async saveError(
    flatFilesRecords: FlatFilesRecords,
    record: FlatFileRecord,
    error: unknown,
    stage: FlatFilesErrorStage = 'RUNNER'
  ): Promise<void> {
    console.log('error', error)
    try {
      flatFilesRecords.create({
        createdAt: Date.now(),
        updatedAt: Date.now(),
        error: [
          {
            keyword: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            stage,
          },
        ],
        fileId: this.s3Key,
        isError: true,
        isProcessed: true,
        initialRecord: JSON.stringify(record.record),
        row: record.index,
      })

      await this.saveRecords(flatFilesRecords, true)
    } catch (saveError) {
      logger.error('Failed to save error record', {
        originalError: error instanceof Error ? error.message : 'Unknown error',
        saveError:
          saveError instanceof Error ? saveError.message : 'Unknown error',
        recordId: record.index,
        fileId: this.s3Key,
        stage,
      })
      // Don't re-throw here as this is error handling
    }
  }

  public async validateAndStoreRecords(
    runner: FlatFileRunner<any>,
    metadata?: object
  ): Promise<boolean> {
    const clickhouseConfig = await getClickhouseCredentials(this.tenantId)
    const flatFilesRecords = new FlatFilesRecords({
      credentials: clickhouseConfig,
    })

    let isAllValid = true

    try {
      for await (const data of this.validateRecords(runner, metadata)) {
        try {
          if (!data.valid) {
            await this.saveError(
              flatFilesRecords,
              data.record,
              {
                name: 'VALIDATION_ERROR',
                message: data?.errors?.map((e) => e.message).join(', '),
              },
              'VALIDATE'
            )
            isAllValid = false
            continue
          }

          await this.createRecord(flatFilesRecords, data)
          isAllValid = isAllValid && data.valid
          await this.saveRecords(flatFilesRecords)
        } catch (error) {
          await this.saveError(flatFilesRecords, data.record, error, 'RUNNER')
          logger.error('Failed to process record', {
            error: error instanceof Error ? error.message : 'Unknown error',
            recordId: data.record.index,
            fileId: this.s3Key,
          })
          isAllValid = false
        }
      }

      // Save any remaining records
      await this.saveRecords(flatFilesRecords, true)
    } catch (error) {
      logger.error('Failed to validate and store records', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileId: this.s3Key,
      })
      throw error
    }

    return isAllValid
  }
}
