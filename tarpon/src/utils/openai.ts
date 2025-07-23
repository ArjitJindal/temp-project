import { StackConstants } from '@lib/constants'
import { ObjectId } from 'mongodb'
import { OpenAI } from 'openai'
import {
  GetCommand,
  GetCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { CLICKHOUSE_DEFINITIONS } from './clickhouse/definition'
import {
  batchInsertToClickhouse,
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from './clickhouse/utils'
import {
  getDynamoDbClient,
  sanitizeMongoObject,
  DynamoTransactionBatch,
} from './dynamodb'
import { envIs } from './env'
import { GPT_REQUESTS_COLLECTION } from './mongodb-definitions'
import { getSecret } from './secrets-manager'
import { LLMLogObject } from './llms'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context-storage'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
let openai: OpenAI | null = null

export enum ModelVersion {
  GPT3 = 'gpt-3.5-turbo',
  GPT4 = 'gpt-4-turbo-preview',
  GPT4O = 'gpt-4o',
  GPT4O_MINI = 'gpt-4o-mini',
}
const modelVersion: ModelVersion = ModelVersion.GPT4O

export type GPTLogObject = {
  _id: string | ObjectId
  prompts: any
  response: string
  createdAt: number
}

export async function ask(
  promptString: string,
  options?: Partial<OpenAI.ChatCompletionCreateParamsNonStreaming>
): Promise<string> {
  return prompt(
    [
      {
        role: 'system',
        content: promptString,
      },
    ],
    options
  )
}

export async function prompt(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.ChatCompletionCreateParamsNonStreaming>
): Promise<string> {
  const tenantId = getContext()?.tenantId

  if (!openai) {
    const { apiKey } = await getSecret<{ apiKey: string }>('openAI')
    openai = new OpenAI({
      apiKey,
    })
  }

  const completion = await openai.chat.completions.create({
    ...options,
    messages,
    model: options?.model ?? modelVersion,
    store: false,
    temperature: options?.temperature ?? 0.5,
  })

  const completionChoice = completion.choices[0].message.content || ''

  tenantId && (await logGPTResponses(tenantId, messages, completionChoice))

  return completionChoice
}

export async function logGPTResponses(
  tenantId: string,
  prompts: OpenAI.ChatCompletionMessageParam[],
  completionChoice: string
) {
  const mongodbClient = await getMongoDbClient()
  const db = mongodbClient.db()
  const collection = db.collection<GPTLogObject>(
    GPT_REQUESTS_COLLECTION(tenantId)
  )
  const gptResponse: GPTLogObject = {
    _id: new ObjectId(),
    prompts: prompts,
    response: completionChoice,
    createdAt: Date.now(),
  }
  await collection.insertOne(gptResponse)
  if (isClickhouseEnabledInRegion()) {
    await linkGPTRequestDynamoDB(tenantId, [gptResponse])
  }
  return gptResponse
}

export async function linkGPTRequestClickhouse(
  tenantId: string,
  gptResponse: LLMLogObject
) {
  await batchInsertToClickhouse(
    tenantId,
    CLICKHOUSE_DEFINITIONS.GPT_REQUESTS.tableName,
    [gptResponse]
  )
}

export async function linkGPTRequestDynamoDB(
  tenantId: string,
  gptResponses: GPTLogObject[]
) {
  const dynamoDb = getDynamoDbClient()
  const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []

  // Create document client and batch for operations
  const docClient = DynamoDBDocumentClient.from(dynamoDb)
  const batch = new DynamoTransactionBatch(docClient, tableName)

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
    await handleLocalChangeCapture(tenantId, keys)
  }
}

export async function getGPTRequestLogById(
  tenantId: string,
  id: ObjectId
): Promise<GPTLogObject | null> {
  if (isClickhouseMigrationEnabled()) {
    const key = DynamoDbKeys.GPT_REQUESTS(tenantId, id.toString())
    const dynamoDb = getDynamoDbClient()
    const commandInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      Key: key,
    }
    const command = new GetCommand(commandInput)
    const commandResult = await dynamoDb.send(command)
    return commandResult.Item as GPTLogObject
  } else {
    const mongodbClient = await getMongoDbClient()
    const db = mongodbClient.db()
    const collection = db.collection<GPTLogObject>(
      GPT_REQUESTS_COLLECTION(tenantId)
    )
    const item = await collection.findOne({ _id: new ObjectId(id) })
    return item
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
