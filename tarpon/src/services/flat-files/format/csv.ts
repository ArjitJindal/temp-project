import { Readable } from 'stream'
import { set } from 'lodash'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { parse } from 'csv-parse'
import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'
import { FlatFileFormat } from '@/services/flat-files/format'
import { EntityModel } from '@/@types/model'
import * as Models from '@/@types/openapi-public/all'
import { FlatFileRecord } from '@/@types/flat-files'
import { getS3Client } from '@/utils/s3'
import { logger } from '@/core/logger'

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
        cast: true,
      })
    )

    let index = 0
    for await (const flatRow of parser) {
      try {
        const nested: Record<string, any> = {}

        for (const [key, value] of Object.entries(flatRow)) {
          if (value) {
            set(nested, key, value) // expand dotted keys
          }
        }

        yield { index: index++, record: nested }
      } catch (error) {
        await this.saveError(
          flatRow,
          { index: index++, record: { record: flatRow } },
          error,
          'PARSE'
        )
        throw error
      }
    }

    logger.info('Finished reading and parsing CSV file')
  }
}
