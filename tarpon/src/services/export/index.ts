import { format as formatCsv } from '@fast-csv/format'
import { S3, GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { AggregationCursor } from 'mongodb'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { shortId } from '@flagright/lib/utils'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'

type CsvAction<T> = T extends string | number | boolean
  ? 'INCLUDE' | 'SKIP'
  : T extends unknown[]
  ? 'JSON' | 'SKIP'
  : 'JSON' | 'SKIP' | CsvHeaderSettings<T>
type CsvHeaderSettingsKeys<T> = T extends CsvHeaderSettings<infer S>
  ? keyof S
  : never

export type CsvHeaderSettings<T> = {
  [K in keyof T]-?: CsvAction<NonNullable<T[K]>>
}

interface Row {
  [key: string]: string | number | boolean | undefined | null
}

function makeHeader<T>(headerSettings: CsvHeaderSettings<T>): string[] {
  const result: any[] = []
  for (const [key, action] of Object.entries(headerSettings)) {
    if (action === 'SKIP') {
      continue
    }
    if (action === 'INCLUDE' || action === 'JSON') {
      result.push(key)
      continue
    }
    if (typeof action === 'object' && action != null) {
      result.push(...makeHeader(action).map((x) => `${key}.${x}`))
    }
  }
  return result
}

function makeRows<T>(object: T, reference: CsvHeaderSettings<T>): Row {
  const result: Row = {}
  function traverse<T>(object: T, reference: CsvHeaderSettings<T>) {
    for (const entry of Object.entries(reference)) {
      const key = entry[0] as CsvHeaderSettingsKeys<CsvHeaderSettings<T>>
      const action = entry[1] as CsvAction<(typeof object)[typeof key]>
      if (action === 'SKIP') {
        continue
      }
      if (action === 'INCLUDE') {
        result[key as string] = (object[key] as any) ?? ''
        continue
      }
      if (action === 'JSON') {
        result[key as string] = JSON.stringify(object[key])
        continue
      }
      if (typeof action === 'object') {
        traverse(object[key] ?? {}, reference[key] ?? {})
      }
    }
  }

  traverse(object, reference)
  return result
}

export interface ExportInfo {
  downloadUrl: string
}

@traceable
export class ExportService<T> {
  entityName: string
  s3: S3
  tmpBucketName: string

  constructor(entityName: string, s3: S3, tmpBucketName: string) {
    this.entityName = entityName
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
  }

  async export(
    cursor: AggregationCursor<T>,
    headerSettings: CsvHeaderSettings<T>
  ): Promise<ExportInfo> {
    const date = dayjs().format('YYYYMMDD-HHmmss')
    const randomId = shortId()
    const filename = `export-${this.entityName}-list-${date}-${randomId}.csv`
    const bucket = this.tmpBucketName

    const headers = makeHeader(headerSettings)

    const stream = formatCsv({
      headers,
      alwaysWriteHeaders: true,
      transform: (object: any) => makeRows(object, headerSettings),
    })

    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: bucket,
        Key: filename,
        Body: stream,
      },
    })

    for await (const datum of cursor) {
      stream.write(datum)
    }
    stream.end()

    await parallelUploadS3.done()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filename,
    })

    const signedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600,
    })

    return {
      downloadUrl: signedUrl,
    }
  }
}
