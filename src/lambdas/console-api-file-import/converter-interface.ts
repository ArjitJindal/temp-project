import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ParserOptionsArgs } from '@fast-csv/parse'
import { MongoClient } from 'mongodb'

export interface ConverterInterface<T> {
  initialize(
    tenantId?: string,
    connections?: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ): Promise<void>
  getCsvParserOptions(): ParserOptionsArgs
  validate(item: unknown): string[]
  convert(item: unknown): T | null
}
