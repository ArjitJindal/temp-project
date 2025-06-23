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
import { getContext } from '@/core/utils/context-storage'
import { tenantSettings } from '@/core/utils/context'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export type LLMLogObject = {
  _id: string | ObjectId
  prompts: any
  response: string
  createdAt: number
}

const getLLMService = (provider: LLMProvider) => {
  switch (provider) {
    case 'OPEN_AI':
      return new OpenAIService()
    case 'ANTHROPIC':
      return new AnthropicService()
  }
}

const getLLMServiceForTenant = async () => {
  const tenantId = getContext()?.tenantId
  if (!tenantId) {
    throw new Error('Tenant ID is required')
  }
  const settings = await tenantSettings(tenantId)
  const provider = settings.llmProvider ?? 'ANTHROPIC'
  return getLLMService(provider)
}

export const ask = async (promptString: string, options?: LLMOptions) => {
  const service = await getLLMServiceForTenant()
  return service.ask(promptString, options)
}

export const prompt = async (messages: Message[], options?: LLMOptions) => {
  const service = await getLLMServiceForTenant()
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
