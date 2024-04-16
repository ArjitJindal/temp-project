import { parseString } from '@fast-csv/parse'
import * as createError from 'http-errors'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { CopyObjectCommand, S3 } from '@aws-sdk/client-s3'
import { ConverterInterface } from './converter-interface'
import { converters as transactionConverters } from './transaction'
import { converters as userConverters } from './user'
import { converters as businessConverters } from './business'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { User } from '@/@types/openapi-public/User'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { Business } from '@/@types/openapi-public/Business'
import {
  ImportRequest,
  ImportRequestFormatEnum,
} from '@/@types/openapi-internal/ImportRequest'
import { RulesEngineService } from '@/services/rules-engine'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'

@traceable
export class Importer {
  tenantId: string
  tenantName: string
  connections: {
    dynamoDb: DynamoDBDocumentClient
    mongoDb: MongoClient
    s3: S3
  }
  importTmpBucket: string
  importBucket: string
  rulesEngine: RulesEngineService

  constructor(
    tenantId: string,
    tenantName: string,
    connections: {
      dynamoDb: DynamoDBDocumentClient
      mongoDb: MongoClient
      s3: S3
    },
    importTmpBucket: string,
    importBucket: string
  ) {
    this.tenantId = tenantId
    this.tenantName = tenantName
    this.connections = connections
    this.importTmpBucket = importTmpBucket
    this.importBucket = importBucket
    this.rulesEngine = new RulesEngineService(
      this.tenantId,
      this.connections.dynamoDb
    )
  }

  public async importTransactions(
    importRequest: ImportRequest
  ): Promise<number> {
    const { format } = importRequest
    const converter = transactionConverters[this.getFormat(format)]
    if (!converter) {
      throw new Error(`Unknown import format: ${format}`)
    }
    return this.importItems(
      importRequest,
      converter,
      this.importTransaction.bind(this)
    )
  }

  private async importTransaction(transaction: Transaction): Promise<void> {
    const transactionResult = await this.rulesEngine.verifyTransaction(
      transaction
    )
    logger.debug(`Imported transaction (id=${transactionResult.transactionId})`)
  }

  public async importConsumerUsers(
    importRequest: ImportRequest
  ): Promise<number> {
    const { format } = importRequest
    const converter = userConverters[this.getFormat(format)]
    if (!converter) {
      throw new Error(`Unknown import format: ${format}`)
    }
    return this.importItems(
      importRequest,
      converter,
      this.importConsumerUser.bind(this)
    )
  }

  private async importConsumerUser(user: User): Promise<void> {
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.connections.dynamoDb,
    })
    const userResult = await userRepository.saveConsumerUser(user)
    logger.debug(`Imported consumer user (id=${userResult.userId})`)
  }

  public async importBusinessUsers(
    importRequest: ImportRequest
  ): Promise<number> {
    const { format } = importRequest
    const converter = businessConverters[this.getFormat(format)]
    if (!converter) {
      throw new Error(`Unknown import format: ${format}`)
    }
    return this.importItems(
      importRequest,
      converter,
      this.importBusinessUser.bind(this)
    )
  }

  private async importBusinessUser(user: Business): Promise<void> {
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.connections.dynamoDb,
    })
    const userResult = await userRepository.saveBusinessUser(user)
    logger.debug(`Imported business user (id=${userResult.userId})`)
  }

  private async importItems(
    importRequest: ImportRequest,
    converter: ConverterInterface<unknown>,
    importFunc: (item: any) => Promise<void>
  ): Promise<number> {
    const { s3Key } = importRequest

    await converter.initialize(this.tenantId, {
      dynamoDb: this.connections.dynamoDb,
      mongoDb: this.connections.mongoDb,
    })

    let importedCount = 0
    const params = {
      Bucket: this.importTmpBucket,
      Key: s3Key,
    }

    const getObj = await this.connections.s3.getObject(params)

    const body = await getObj.Body?.transformToString()
    const stream = parseString(body ?? '', converter.getCsvParserOptions())

    for await (const rawItem of stream) {
      const validationResult = converter.validate(rawItem)
      if (validationResult.length > 0) {
        throw new createError.BadRequest(validationResult.join(', '))
      }
      const item = converter.convert(rawItem)
      if (item) {
        await importFunc(item)
        importedCount += 1
      }
    }

    const copyObjectCommand = new CopyObjectCommand({
      CopySource: `${this.importTmpBucket}/${s3Key}`,
      Bucket: this.importBucket,
      Key: s3Key,
    })

    await this.connections.s3.send(copyObjectCommand)

    return importedCount
  }

  private getFormat(format: ImportRequestFormatEnum): string {
    return format === 'custom' ? this.tenantName : 'flagright'
  }
}
