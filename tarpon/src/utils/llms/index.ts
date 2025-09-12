import { ObjectId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  getDynamoDbClient,
  sanitizeMongoObject,
  DynamoTransactionBatch,
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

const getLLMServiceForTenant = async (
  tenantId: string,
  defaultProvider?: LLMProvider
) => {
  const settings = await tenantSettings(tenantId)
  const provider = defaultProvider ?? settings.llmProvider ?? 'ANTHROPIC'
  return getLLMService(tenantId, provider)
}

export const ask = async (
  tenantId: string,
  promptString: string,
  options?: LLMOptions
) => {
  const service = await getLLMServiceForTenant(tenantId, options?.provider)
  return service.ask(promptString, options)
}

export const prompt = async (
  tenantId: string,
  messages: Message[],
  options?: LLMOptions
) => {
  const service = await getLLMServiceForTenant(tenantId, options?.provider)
  return service.prompt(messages, options)
}

export async function linkLLMRequestDynamoDB(
  tenantId: string,
  gptResponses: LLMLogObject[]
) {
  const dynamoDb = getDynamoDbClient()
  const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []

  // Create document client and batch for operations
  const batch = new DynamoTransactionBatch(dynamoDb, tableName)

  for (const gptResponse of gptResponses) {
    if (!gptResponse._id) {
      continue
    }
    const key = DynamoDbKeys.GPT_REQUESTS(tenantId, gptResponse._id.toString())
    keys.push(key)
    const data = sanitizeMongoObject(gptResponse)

    batch.put({
      Item: {
        ...key,
        ...data,
      },
    })
  }

  await batch.execute()
  if (envIs('local') || envIs('test')) {
    const { handleLocalTarponChangeCapture } = await import(
      '@/core/local-handlers/tarpon'
    )
    await handleLocalTarponChangeCapture(tenantId, keys)
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
