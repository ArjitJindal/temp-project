import { Readable } from 'stream'
import set from 'lodash/set'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { parse } from 'csv-parse'
import { ErrorRecord } from '../utils'
import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'
import { FlatFileFormat } from '@/services/flat-files/format'
import { EntityModel } from '@/@types/model'
import * as Models from '@/@types/openapi-public/all'
import { FlatFileRecord } from '@/@types/flat-files'
import { getS3Client } from '@/utils/s3'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { getClickhouseCredentials } from '@/utils/clickhouse/client'

@traceable
export class CsvFormat extends FlatFileFormat {
  static readonly format = 'CSV'

  private generateCsvTemplateFromEntityClass(
    entityClass: typeof EntityModel,
    prefix: string = ''
  ): FlatFileTemplateResponse {
    const headers: string[] = []

    logger.info('Generating CSV template from entity class', {
      entityClass: entityClass.name,
    })

    // Process all attributes
    for (const attribute of entityClass.attributeTypeMap) {
      const currentPath = prefix
        ? `${prefix}.${attribute.baseName}`
        : attribute.baseName

      // Handle arrays
      if (attribute.type.startsWith('Array<')) {
        const arrayType = attribute.type.match(/Array<(.+)>/)?.[1]
        if (arrayType) {
          // For arrays, we'll add a sample index (0) to show the structure
          const arrayPath = `${currentPath}.0`
          if (Models[arrayType]) {
            // If array contains objects, recursively process them
            const nestedTemplate = this.generateCsvTemplateFromEntityClass(
              Models[arrayType],
              arrayPath
            )
            headers.push(...nestedTemplate.keys)
          } else {
            // If array contains primitives, just add the path
            headers.push(arrayPath)
          }
        }
      }
      // Handle nested objects
      else if (Models[attribute.type]) {
        const nestedTemplate = this.generateCsvTemplateFromEntityClass(
          Models[attribute.type],
          currentPath
        )
        headers.push(...nestedTemplate.keys)
      }
      // Handle primitive types
      else {
        headers.push(currentPath)
      }
    }

    // Create CSV string with headers
    const fileString = headers.join(',') + '\n'

    logger.info('Generated CSV template')
    return { keys: headers, fileString }
  }

  public getTemplate(): FlatFileTemplateResponse {
    const model = this.model
    return this.generateCsvTemplateFromEntityClass(model)
  }

  public async *readAndParse(s3Key: string): AsyncGenerator<FlatFileRecord> {
    const s3 = getS3Client()

    logger.info('Reading and parsing CSV file', {
      s3Key,
    })

    const { Body } = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.DOCUMENT_BUCKET,
        Key: s3Key,
      })
    )
    if (!(Body instanceof Readable)) {
      throw new Error('Expected Body to be a Node.js Readable stream')
    }

    const parser = Body.setEncoding('utf-8').pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        raw: true, // this will return the raw record that we are parsing helpfult to generate error csv
      })
    )

    const clickhouseConfig = await getClickhouseCredentials(this.tenantId)
    const flatFilesRecords = new FlatFilesRecords({
      credentials: clickhouseConfig,
      options: {
        keepAlive: true,
        keepAliveTimeout: 9000, // our ch server timeout is 10 seconds it is recommended to set it below server timeout
        maxRetries: 10,
      },
    })

    let index = 0
    for await (const flatRow of parser) {
      try {
        const nested: Record<string, any> = {}

        for (const [key, value] of Object.entries(flatRow.record)) {
          if (value) {
            set(nested, key, value) // expand dotted keys
          }
        }
        if (
          this.isDuplicate(nested, (record: Record<string, object>) => {
            this.afterDuplicateCheck(record)
          })
        ) {
          await this.saveError(
            flatFilesRecords,
            {
              index: index++,
              record: { record: flatRow.record },
              initialRecord: flatRow.raw.replace(/[\r\n]+/g, ' ').trim(),
            },
            new Error('Duplicate record'),
            'DUPLICATE'
          )
          continue
        }
        yield {
          index: index++,
          record: nested,
          initialRecord: flatRow.raw.replace(/[\r\n]+/g, ' ').trim(),
        }
      } catch (error) {
        await this.saveError(
          flatFilesRecords,
          {
            index: index++,
            record: { record: flatRow.record },
            initialRecord: flatRow.raw.replace(/[\r\n]+/g, ' '),
          },
          error,
          'PARSE'
        )
        throw error
      }
    }

    logger.info('Finished reading and parsing CSV file')
  }

  public preProcessFile() {
    const { keys: header } = this.getTemplate()
    header.push('Error Message')
    header.push('Error Codes')
    const formatedHeader = header.map((columnHeader) => {
      const santiziedHeader = columnHeader.split('"').join("'")
      return `"${santiziedHeader}"`
    }) // ensuring commas in header are handled
    return formatedHeader.join(',') + '\n'
  }

  public handleErroredRecrod(records: ErrorRecord[]): string {
    const formatedRecords: string[] = []
    records.forEach((erroredRecord) => {
      // the csv parser handles records cell with , in them. We have to leverage this while creating a comma seperated row
      // cells having , in their content are enclosed in "" by the parser, we need to iterate the whole string partition for these cells
      const record = erroredRecord.record
      const errorMessage: string = erroredRecord.error.errorMessage
        .split('"')
        .join("'")
      const errorCode: string = erroredRecord.error.errorCode
        .split('"')
        .join("'")
      formatedRecords.push(`${record},"${errorMessage}","${errorCode}"`)
    })
    return formatedRecords.join('\n')
  }

  public postProcessFile() {
    return undefined
  }

  public getErroredFileContentType() {
    return 'text/csv'
  }
}
