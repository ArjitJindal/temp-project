import { FlatFileFormat } from './index'
import { FlatFileTemplateResponse } from '@/@types/openapi-internal/FlatFileTemplateResponse'
import { FlatFileRecord } from '@/@types/flat-files'
import { jsonlStreamReader } from '@/utils/jsonl'
import { traceable } from '@/core/xray'

@traceable
export class JsonlFormat extends FlatFileFormat {
  static readonly format = 'JSONL'

  public getTemplate(): FlatFileTemplateResponse {
    // TODO: implement template for JSONL
    return {
      keys: [],
      fileString: '',
    }
  }

  public async *readAndParse(s3Key: string): AsyncGenerator<FlatFileRecord> {
    const documentBucket = process.env.DOCUMENT_BUCKET

    if (!documentBucket) {
      throw new Error('DOCUMENT_BUCKET is not set')
    }

    const lines = await jsonlStreamReader(s3Key, documentBucket)
    let index = 0
    for await (const line of lines) {
      yield { index: index++, record: JSON.parse(line) }
    }
  }
}
