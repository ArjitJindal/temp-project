import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '@/utils/s3'

export interface S3StreamReaderOptions {
  bucket?: string
  concurrency?: number
}

/**
 * Creates an async iterator that reads an S3 object stream line by line
 * @param s3Key - The S3 key of the object to read
 * @param options - Optional configuration
 * @returns Async iterator that yields lines from the S3 object
 */
export async function jsonlStreamReader(
  s3Key: string,
  bucket: string
): Promise<AsyncIterable<string>> {
  const s3 = getS3Client()
  const { Body } = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    })
  )

  const stream = Body?.transformToWebStream()
  if (!stream) {
    throw new Error('Stream is undefined')
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()

  return {
    async *[Symbol.asyncIterator]() {
      let leftover = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            if (leftover) {
              yield leftover
            }
            break
          }
          const chunk = decoder.decode(value, { stream: true })
          const lines = (leftover + chunk).split('\n')
          leftover = lines.pop() || ''
          for (const line of lines) {
            if (line) {
              yield line
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    },
  }
}
