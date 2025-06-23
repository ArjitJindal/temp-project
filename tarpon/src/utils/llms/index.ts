import { ObjectId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  getDynamoDbClient,
  sanitizeMongoObject,
  transactWrite,
  TransactWriteOperation,
} from '../dynamodb'
import { envIs } from '../env'
import { CLICKHOUSE_DEFINITIONS } from '../clickhouse/definition'
import { batchInsertToClickhouse } from '../clickhouse/utils'
import { OpenAIService } from './openai'
import { AnthropicService } from './anthropic'
import { LLMOptions, Message } from './base-service'
import { LLMProvider } from '@/@types/openapi-internal/LLMProvider'
import { tenantSettings } from '@/core/utils/context'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export type LLMLogObject = {
  _id: string | ObjectId
  prompts: Message[]
  response: string
  createdAt: number
}

const getLLMService = (tenantId: string, provider: LLMProvider) => {
  switch (provider) {
    case 'OPEN_AI':
      return new OpenAIService(tenantId)
    case 'ANTHROPIC':
      return new AnthropicService(tenantId)
  }
}

const getLLMServiceForTenant = async (tenantId: string) => {
  const settings = await tenantSettings(tenantId)
  const provider = settings.llmProvider ?? 'ANTHROPIC'
  return getLLMService(tenantId, provider)
}

export const ask = async (
  tenantId: string,
  promptString: string,
  options?: LLMOptions
) => {
  const service = await getLLMServiceForTenant(tenantId)
  return service.ask(promptString, options)
}

export const prompt = async (
  tenantId: string,
  messages: Message[],
  options?: LLMOptions
) => {
  const service = await getLLMServiceForTenant(tenantId)
  return service.prompt(messages, options)
}

export async function linkLLMRequestDynamoDB(
  tenantId: string,
  gptResponses: LLMLogObject[]
) {
  const dynamoDb = getDynamoDbClient()
  const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  const writeRequests: TransactWriteOperation[] = []
  const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []
  for (const gptResponse of gptResponses) {
    if (!gptResponse._id) {
      continue
    }
    const key = DynamoDbKeys.GPT_REQUESTS(tenantId, gptResponse._id.toString())
    keys.push(key)
    const data = sanitizeMongoObject(gptResponse)
    writeRequests.push({
      Put: {
        TableName: tableName,
        Item: {
          ...key,
          ...data,
        },
      },
    })
  }
  await transactWrite(dynamoDb, writeRequests)
  if (envIs('local') || envIs('test')) {
    await handleLocalChangeCapture(tenantId, keys)
  }
}

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const key of primaryKey) {
    await localTarponChangeCaptureHandler(tenantId, key, 'TARPON')
  }
}

export async function linkLLMRequestClickhouse(
  tenantId: string,
  gptResponse: LLMLogObject
) {
  await batchInsertToClickhouse(
    tenantId,
    CLICKHOUSE_DEFINITIONS.GPT_REQUESTS.tableName,
    [gptResponse]
  )
}
